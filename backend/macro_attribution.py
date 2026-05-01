"""
backend/macro_attribution.py
─────────────────────────────
Fetches FRED macroeconomic data and attributes market regimes
to macro drivers via logistic regression + correlation analysis.

Key research claim:
  "Crash regimes occur when unemployment rises >Xpp/month AND
   VIX >Y with Z% precision - connecting statistical regimes
   to real economic fundamentals."
"""

import numpy as np
import pandas as pd
import os
from typing import Optional
import warnings

warnings.filterwarnings("ignore")

FRED_SERIES = {
    "unrate":    ("UNRATE",    "Unemployment Rate",        "%"),
    "fedfunds":  ("FEDFUNDS",  "Fed Funds Rate",           "%"),
    "cpi":       ("CPIAUCSL",  "CPI (YoY)",                "%"),
    "t10y2y":    ("T10Y2Y",    "Yield Curve (10Y-2Y)",     "pp"),
    "vix":       ("VIXCLS",    "VIX",                      "pts"),
    "indpro":    ("INDPRO",    "Industrial Production",    "idx"),
}

REGIME_LABELS = {0: "crash", 1: "bearish", 2: "transitional", 3: "bullish"}
REGIME_COLORS = {
    "crash":        "#a855f7",
    "bearish":      "#ef4444",
    "transitional": "#f59e0b",
    "bullish":      "#22c55e",
}


def _safe_float(val, default=0.0):
    try:
        f = float(val)
        return default if (np.isnan(f) or np.isinf(f)) else f
    except Exception:
        return default


def fetch_fred_data(
    start_date: str,
    end_date: str,
    api_key: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetch macro series from FRED and return a daily-resampled DataFrame.
    Monthly series (UNRATE, FEDFUNDS, CPI) are forward-filled to daily.
    """
    from fredapi import Fred

    key = api_key or os.environ.get("FRED_API_KEY", "")
    if not key:
        raise ValueError("FRED_API_KEY not set")

    fred = Fred(api_key=key)
    frames = {}

    for name, (series_id, label, unit) in FRED_SERIES.items():
        try:
            s = fred.get_series(
                series_id,
                observation_start=start_date,
                observation_end=end_date,
            )
            frames[name] = s
        except Exception as e:
            print(f"[macro] FRED fetch failed for {series_id}: {e}")

    if not frames:
        raise RuntimeError("All FRED fetches failed - check API key")

    df = pd.DataFrame(frames)
    df.index = pd.to_datetime(df.index)

    df = df.resample("D").last().ffill()

    if "unrate" in df.columns:
        df["unrate_mom"] = df["unrate"].diff(21)   
    if "cpi" in df.columns:
        df["cpi_yoy"] = df["cpi"].pct_change(252) * 100
    if "fedfunds" in df.columns:
        df["fedfunds_change"] = df["fedfunds"].diff(63)  

    return df


def align_macro_to_regimes(
    macro_df: pd.DataFrame,
    regime_dates: list[str],
    regime_states: np.ndarray,
) -> pd.DataFrame:
    """
    Align FRED macro data to the regime date index.
    Returns merged DataFrame with regime column.
    """
    regime_series = pd.Series(
        regime_states,
        index=pd.to_datetime(regime_dates),
        name="regime",
    )

    regime_series = regime_series[~regime_series.index.duplicated(keep="last")]
    macro_df = macro_df[~macro_df.index.duplicated(keep="last")]

    macro_aligned = macro_df.reindex(regime_series.index, method="ffill")
    merged = pd.concat([macro_aligned, regime_series], axis=1).dropna(subset=["regime"])
    merged["regime"] = merged["regime"].astype(int)

    return merged


def compute_regime_macro_stats(merged: pd.DataFrame) -> dict:
    """
    For each regime, compute mean and std of each macro variable.
    Returns dict keyed by regime label.
    """
    features = [c for c in merged.columns if c != "regime"]
    stats = {}

    for r, label in REGIME_LABELS.items():
        mask = merged["regime"] == r
        n = int(mask.sum())
        if n == 0:
            stats[label] = {"n_days": 0}
            continue

        regime_stats = {"n_days": n}
        for feat in features:
            if feat not in merged.columns:
                continue
            vals = merged.loc[mask, feat].dropna()
            if len(vals) == 0:
                continue
            regime_stats[feat] = {
                "mean": round(_safe_float(vals.mean()), 3),
                "std":  round(_safe_float(vals.std()),  3),
                "min":  round(_safe_float(vals.min()),  3),
                "max":  round(_safe_float(vals.max()),  3),
            }
        stats[label] = regime_stats

    return stats


def compute_macro_correlations(merged: pd.DataFrame) -> dict:
    """
    Correlate each macro variable with regime label (treated as ordinal 0-3).
    Returns sorted list of (feature, correlation) for display.
    """
    features = [c for c in merged.columns if c != "regime"]
    corrs = {}

    for feat in features:
        if feat not in merged.columns:
            continue
        valid = merged[["regime", feat]].dropna()
        if len(valid) < 10:
            continue
        c = float(valid["regime"].corr(valid[feat]))
        if not np.isnan(c):
            corrs[feat] = round(c, 3)

    sorted_corrs = sorted(corrs.items(), key=lambda x: abs(x[1]), reverse=True)
    return {k: v for k, v in sorted_corrs}


def fit_macro_logistic(merged: pd.DataFrame) -> dict:
    """
    Logistic regression: predict crash (regime=0) from macro features.
    Returns coefficients and precision/recall for crash detection.
    """
    from scipy.stats import pearsonr

    features = ["unrate", "fedfunds", "t10y2y", "vix", "unrate_mom", "fedfunds_change"]
    available = [f for f in features if f in merged.columns]

    if len(available) < 2:
        return {"fitted": False, "reason": "Insufficient macro features"}

    X = merged[available].dropna()
    X = X[~X.index.duplicated(keep="last")]         
    y_crash = (merged.loc[X.index, "regime"] == 0).astype(int)
    y_crash = y_crash[~y_crash.index.duplicated(keep="last")]
    X, y_crash = X.align(y_crash, join="inner", axis=0)

    if y_crash.sum() < 5:
        return {"fitted": False, "reason": "Fewer than 5 crash days in sample"}

    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import precision_score, recall_score

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        clf = LogisticRegression(max_iter=500, class_weight="balanced")
        clf.fit(X_scaled, y_crash)

        y_pred = clf.predict(X_scaled)
        precision = round(float(precision_score(y_crash, y_pred, zero_division=0)), 3)
        recall    = round(float(recall_score(y_crash, y_pred, zero_division=0)), 3)

        coefficients = {
            feat: round(float(coef), 3)
            for feat, coef in zip(available, clf.coef_[0])
        }

        sorted_coefs = dict(
            sorted(coefficients.items(), key=lambda x: abs(x[1]), reverse=True)
        )

        return {
            "fitted":       True,
            "coefficients": sorted_coefs,
            "precision":    precision,
            "recall":       recall,
            "n_crash_days": int(y_crash.sum()),
            "n_total_days": int(len(y_crash)),
            "top_predictor": list(sorted_coefs.keys())[0] if sorted_coefs else "-",
        }

    except ImportError:
        corr_coefs = {}
        for feat in available:
            valid = merged[["regime", feat]].dropna()
            if len(valid) < 10:
                continue
            crash_mask = valid["regime"] == 0
            feat_vals  = valid[feat]
            c = float(crash_mask.astype(float).corr(feat_vals))
            if not np.isnan(c):
                corr_coefs[feat] = round(c, 3)

        sorted_coefs = dict(
            sorted(corr_coefs.items(), key=lambda x: abs(x[1]), reverse=True)
        )
        return {
            "fitted":       True,
            "coefficients": sorted_coefs,
            "precision":    None,
            "recall":       None,
            "n_crash_days": int((merged["regime"] == 0).sum()),
            "n_total_days": int(len(merged)),
            "top_predictor": list(sorted_coefs.keys())[0] if sorted_coefs else "-",
            "note":         "sklearn unavailable - correlation coefficients shown",
        }
    except Exception as e:
        return {"fitted": False, "reason": str(e)}


def get_current_macro_snapshot(macro_df: pd.DataFrame) -> dict:
    """
    Latest available values for each macro series.
    """
    snapshot = {}
    latest = macro_df.dropna(how="all").iloc[-1]
    latest_date = str(macro_df.dropna(how="all").index[-1].date())

    meta = {
        "unrate":           ("Unemployment Rate",     "%",   False),
        "fedfunds":         ("Fed Funds Rate",         "%",   False),
        "cpi_yoy":          ("CPI YoY",                "%",   False),
        "t10y2y":           ("Yield Curve (10Y-2Y)",   "pp",  True),
        "vix":              ("VIX",                    "pts", False),
        "indpro":           ("Industrial Production",  "idx", False),
        "unrate_mom":       ("Unemployment MoM Δ",     "pp",  True),
        "fedfunds_change":  ("Fed Funds Qtr Δ",        "pp",  True),
    }

    for key, (label, unit, can_negative) in meta.items():
        if key in macro_df.columns:
            val = _safe_float(latest.get(key, None))
            snapshot[key] = {
                "label": label,
                "value": round(val, 3),
                "unit":  unit,
            }

    snapshot["as_of"] = latest_date
    return snapshot


def run_macro_attribution(
    regime_dates: list[str],
    regime_states: np.ndarray,
    api_key: Optional[str] = None,
) -> dict:
    """
    Main entry point called by FastAPI endpoint.
    """
    start = regime_dates[0]
    end   = regime_dates[-1]

    macro_df = fetch_fred_data(start, end, api_key=api_key)

    merged = align_macro_to_regimes(macro_df, regime_dates, regime_states)

    regime_stats = compute_regime_macro_stats(merged)

    correlations = compute_macro_correlations(merged)

    logistic = fit_macro_logistic(merged)

    snapshot = get_current_macro_snapshot(macro_df)

    top_corr_feat = list(correlations.keys())[0] if correlations else "VIX"
    top_corr_val  = list(correlations.values())[0] if correlations else 0
    feat_label = FRED_SERIES.get(top_corr_feat, (None, top_corr_feat))[1]
    finding = (
        f"'{feat_label}' shows strongest correlation with regime (ρ={top_corr_val}). "
        f"Crash precision: {logistic.get('precision', '-')}. "
        if logistic.get("fitted") else
        f"'{feat_label}' shows strongest correlation with regime (ρ={top_corr_val})."
    )

    history = []
    for date, row in merged.iterrows():
        history.append({
            "date":   str(date.date()),
            "regime": int(row["regime"]),
            "vix":    round(_safe_float(row.get("vix", 0)),    2),
            "unrate": round(_safe_float(row.get("unrate", 0)), 2),
            "t10y2y": round(_safe_float(row.get("t10y2y", 0)), 3),
        })

    return {
        "regime_macro_stats": regime_stats,
        "correlations":       correlations,
        "logistic":           logistic,
        "snapshot":           snapshot,
        "history":            history,
        "key_finding":        finding,
        "series_meta": {
            k: {"label": v[1], "unit": v[2]}
            for k, v in FRED_SERIES.items()
        },
    }