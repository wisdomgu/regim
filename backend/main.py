from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data import fetch_data, fetch_intraday
from regime import fit_hmm, fit_hmm_4state, get_recommendation, get_recommendation_4state, walk_forward_regimes, smooth_regimes, explain_regime_shap
from regime_forecast import router as forecast_router
from transaction_costs import TransactionCostModel
from vol_forecast import forecast_conditional_vol
from changepoint import run_changepoint_analysis
from scipy.stats import ttest_rel, binomtest
from hmmlearn.hmm import GaussianHMM
import numpy as np
import pandas as pd
import warnings
import traceback
from macro_attribution import run_macro_attribution
import os
from dotenv import load_dotenv

warnings.filterwarnings("ignore", category=UserWarning, module="hmmlearn")
warnings.filterwarnings("ignore", message=".*not converging.*")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(forecast_router)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

def safe_float(val, default=0.0):
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return default
        return f
    except:
        return default

def flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df

@app.get("/api/regime/{ticker}")
def get_regime(ticker: str = "SPY", period: str = "1y"):
    try:
        df = flatten_columns(fetch_data(ticker, period))
        if df.empty or len(df) < 30:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        if states is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)
        current_regime = int(states[-1])
        current_streak = int(np.sum(np.cumprod((states[::-1] == current_regime))))

        transitions = list(zip(states[:-1], states[1:]))
        same   = sum(1 for a, b in transitions if a == current_regime and b == current_regime)
        switch = sum(1 for a, b in transitions if a == current_regime and b != current_regime)
        total  = same + switch
        stay_prob   = min((same   / total if total > 0 else 0.5), 0.97)
        switch_prob = max((switch / total if total > 0 else 0.5), 0.03)

        df["regime"] = states
        prices = [
            {
                "date":   str(date.date()),
                "open":   round(safe_float(row["Open"]),  2),
                "high":   round(safe_float(row["High"]),  2),
                "low":    round(safe_float(row["Low"]),   2),
                "close":  round(safe_float(row["Close"]), 2),
                "regime": int(row["regime"]),
            }
            for date, row in df.iterrows()
        ]

        return {
            "ticker":  ticker.upper(),
            "prices":  prices,
            "current": {
                **get_recommendation_4state(current_regime),
                "confidence": round(safe_float(confidence[-1]), 3),
            },
            "transition": {
                "stay_prob":              round(stay_prob   * 100, 1),
                "switch_prob":            round(switch_prob * 100, 1),
                "expected_duration_days": round(1 / switch_prob, 1),
                "current_duration_days":  current_streak,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/{ticker}")
def get_backtest(ticker: str = "SPY", period: str = "1y"):
    try:
        df = flatten_columns(fetch_data(ticker, period))
        n = len(df)

        if n < 60:
            raise HTTPException(status_code=400, detail="Not enough data")

        if n >= 300:
            train_window = 252
            step = 21
            use_walkforward = True
        elif n >= 120:
            train_window = int(n * 0.7)
            step = max(10, int(n * 0.05))
            use_walkforward = True
        else:
            use_walkforward = False

        if use_walkforward:
            states, confidence = walk_forward_regimes(df, train_window=train_window, step=step)
            valid = states != -1
            if valid.sum() < 20:
                use_walkforward = False
            else:
                df = df[valid].copy()
                states = states[valid]
                confidence = confidence[valid]

        if not use_walkforward:
            states, confidence, model, scaler, df = fit_hmm_4state(df)
            
        states = smooth_regimes(states, min_duration=3)
        df["regime"] = states
        df["regime_signal"] = pd.Series(states, index=df.index).shift(1)
        df["prior_close"] = df["Close"].shift(1)
        df["twap_cost"] = df["Open"]
        df["regime_cost"] = df["Open"]

        crash_mask = df["regime_signal"] == 0
        df.loc[crash_mask, "regime_cost"] = df.loc[crash_mask, "Open"]

        patient_mask = df["regime_signal"].isin([1, 2])
        df.loc[patient_mask, "regime_cost"] = (
            df.loc[patient_mask, "Open"] + df.loc[patient_mask, "prior_close"]
        ) / 2
        df.dropna(subset=["regime_signal", "prior_close"], inplace=True)

        if len(df) == 0:
            raise ValueError("No data after execution simulation")

        twap_avg   = safe_float(df["twap_cost"].mean())
        regime_avg = safe_float(df["regime_cost"].mean())
        saving_pct = round((twap_avg - regime_avg) / twap_avg * 100, 3) if twap_avg != 0 else 0

        LOW_CONFIDENCE_THRESHOLD = 0.60

        if len(confidence) == len(df):
            conf_series = pd.Series(confidence, index=df.index)
        else:
            conf_series = pd.Series(0.5, index=df.index)

        low_conf_mask = conf_series < LOW_CONFIDENCE_THRESHOLD
        n_transition_days = int(low_conf_mask.sum())
        pct_transition_days = round(n_transition_days / len(df) * 100, 1)

        high_conf_df = df[~low_conf_mask].copy()
        if len(high_conf_df) > 5:
            hc_twap   = safe_float(high_conf_df["twap_cost"].mean())
            hc_regime = safe_float(high_conf_df["regime_cost"].mean())
            hc_saving = round((hc_twap - hc_regime) / hc_twap * 100, 3) if hc_twap != 0 else 0
        else:
            hc_saving = saving_pct

        conf_by_regime = {}
        for r, label in [(0, "crash"), (1, "bearish"), (2, "transitional"), (3, "bullish")]:
            rmask = df["regime"] == r
            conf_by_regime[label] = round(safe_float(conf_series[rmask].mean()), 3)

        rng = np.random.default_rng(42)
        n_boot = len(df)
        boot_savings = []
        for _ in range(1000):
            idx = rng.integers(0, n_boot, size=n_boot)
            t = df["twap_cost"].iloc[idx].mean()
            r = df["regime_cost"].iloc[idx].mean()
            boot_savings.append((t - r) / t * 100 if t != 0 else 0)
        ci_low  = round(safe_float(np.percentile(boot_savings, 2.5)),  3)
        ci_high = round(safe_float(np.percentile(boot_savings, 97.5)), 3)

        regime_params = []
        regime_stats = {}
        trans_mat_ordered = None
        model_selection_info = {"winner": "unknown", "full_bic": None, "diag_bic": None}
        try:
            raw_full = flatten_columns(fetch_data(ticker, period))
            states_full, _, model_full, scaler_full, df_full = fit_hmm_4state(raw_full)
            if model_full is not None:
                means_full = model_full.means_
                scores_full = np.array([float(means_full[i][0]) + float(means_full[i][3]) for i in range(4)])
                order_full = np.argsort(scores_full)
                state_map = {int(old): int(new) for new, old in enumerate(order_full)}
                df_full["regime"] = states_full
                df_full["returns"] = df_full["Close"].pct_change()
                df_full["momentum_raw"] = df_full["Close"].pct_change(5)

                regime_stats = {}
                conf_series_full = pd.Series(confidence, index=df.index) if len(confidence) == len(df) else pd.Series(0.5, index=df.index)

                for r, label in [(0, "crash"), (1, "bearish"), (2, "transitional"), (3, "bullish")]:
                    rmask = df["regime"] == r
                    days  = int(rmask.sum())
                    regime_stats[label] = {
                        "days":           days,
                        "pct":            round(days / len(df) * 100, 1),
                        "mean_return":    round(safe_float(df.loc[rmask, "returns"].mean() * 100 if "returns" in df.columns else 0), 4),
                        "volatility":     round(safe_float(df.loc[rmask, "returns"].std()  * 100 if "returns" in df.columns else 0), 4),
                        "avg_confidence": round(safe_float(conf_series_full[rmask].mean()), 3),
                    }

                trans_mat_ordered = None
                if model_full is not None:
                    state_map_inv = {v: k for k, v in model_full._state_map.items()}
                    reordered = np.zeros((4, 4))
                    for new_i in range(4):
                        for new_j in range(4):
                            raw_i = state_map_inv.get(new_i, new_i)
                            raw_j = state_map_inv.get(new_j, new_j)
                            reordered[new_i, new_j] = model_full.transmat_[raw_i, raw_j]
                    trans_mat_ordered = [[round(float(v), 4) for v in row] for row in reordered]

                for i in range(len(model_full.means_)):
                    label = {0: "crash", 1: "bearish", 2: "transitional", 3: "bullish"}.get(i, str(i))
                    mask = df_full["regime"] == i

                    model_selection_info = {
                        "winner": getattr(model_full, "_cov_type_selected", "unknown"),
                        "full_bic": getattr(model_full, "_bic_results", {}).get("full", None),
                        "diag_bic": getattr(model_full, "_bic_results", {}).get("diag", None),
                    } if model_full else {
                        "winner": "unknown",
                        "full_bic": None,
                        "diag_bic": None,
                    }

                    days_in_regime = int(mask.sum())
                    total_days = len(df_full)

                    trans_mat = model_full.transmat_
                    mapped_i = [k for k, v in state_map.items() if v == i]
                    raw_i = mapped_i[0] if mapped_i else i
                    stay_p = float(trans_mat[raw_i, raw_i])
                    expected_duration = round(1 / (1 - stay_p), 1) if stay_p < 1.0 else 999.0

                    regime_params.append({
                        "regime":            label,
                        "mean_return":       round(safe_float(df_full.loc[mask, "returns"].mean() * 100), 4),
                        "volatility":        round(safe_float(df_full.loc[mask, "returns"].std()  * 100), 4),
                        "momentum":          round(safe_float(df_full.loc[mask, "momentum_raw"].mean() * 100), 4),
                        "days_in_regime":    days_in_regime,
                        "pct_of_period":     round(days_in_regime / total_days * 100, 1),
                        "expected_duration": expected_duration,
                        "stay_probability":  round(stay_p * 100, 1),
                    })
        except Exception as e:
            print(f"regime_params failed: {e}")
            traceback.print_exc()

        if not regime_params:
            regime_params = [
                {"regime": "bearish",      "mean_return": 0, "volatility": 0, "momentum": 0},
                {"regime": "transitional", "mean_return": 0, "volatility": 0, "momentum": 0},
                {"regime": "bullish",      "mean_return": 0, "volatility": 0, "momentum": 0},
            ]

        confidence_series = (
            pd.Series(confidence, index=df.index)
            if len(confidence) == len(df)
            else pd.Series(0.5, index=df.index)
        )

        daily = [
            {
                "date":         str(date.date()),
                "twap":         round(safe_float(row["twap_cost"]),   2),
                "regime_aware": round(safe_float(row["regime_cost"]), 2),
                "regime":       int(row["regime"]),
                "confidence":   round(safe_float(confidence_series.get(date, 0.5)), 3),
            }
            for date, row in df.iterrows()
        ]

        df["next_return"] = df["Close"].pct_change().shift(-1)
        accuracy_rows = df.dropna(subset=["regime_signal", "next_return"])
        total_predictions = len(accuracy_rows)

        if total_predictions > 0:
            bullish_correct = int(((accuracy_rows["regime_signal"] == 1) & (accuracy_rows["next_return"] > 0)).sum())
            bearish_correct = int(((accuracy_rows["regime_signal"] == 0) & (accuracy_rows["next_return"] < 0)).sum())
            bullish_total   = int((accuracy_rows["regime_signal"] == 1).sum())
            bearish_total   = int((accuracy_rows["regime_signal"] == 0).sum())
            bullish_hit_rate = round(bullish_correct / bullish_total * 100, 1) if bullish_total > 0 else 0
            bearish_hit_rate = round(bearish_correct / bearish_total * 100, 1) if bearish_total > 0 else 0
            overall_hit_rate = round((bullish_correct + bearish_correct) / total_predictions * 100, 1)
        else:
            bullish_hit_rate = bearish_hit_rate = overall_hit_rate = 0
            bullish_total = bearish_total = 0

        t_stat, p_value = ttest_rel(df["twap_cost"], df["regime_cost"])

        rng_perm = np.random.default_rng(99)
        observed_saving = saving_pct
        perm_savings = []

        regime_signals = df["regime_signal"].values.copy()

        for _ in range(1000):
            shuffled = rng_perm.permutation(regime_signals)
            perm_cost = df["twap_cost"].copy()
            patient_mask = pd.Series(shuffled, index=df.index).isin([0, 1])
            perm_cost[patient_mask] = (
                df.loc[patient_mask, "Open"] + df.loc[patient_mask, "prior_close"]
            ) / 2
            t = df["twap_cost"].mean()
            r = perm_cost.mean()
            perm_savings.append((t - r) / t * 100 if t != 0 else 0)

        perm_savings = np.array(perm_savings)
        perm_p_value = float(np.mean(perm_savings >= observed_saving))
        perm_percentile = float(np.mean(perm_savings < observed_saving) * 100)
        perm_null_mean = round(float(np.mean(perm_savings)), 4)
        perm_null_std  = round(float(np.std(perm_savings)),  4)

        binom_result = binomtest(
            int(overall_hit_rate * total_predictions / 100),
            total_predictions,
            0.5,
            alternative='greater'
        ) if total_predictions > 0 else None
        p_acc = binom_result.pvalue if binom_result else 1.0

        df_ma = df.copy()
        df_ma["ma50"]  = df_ma["Close"].rolling(50).mean()
        df_ma["ma200"] = df_ma["Close"].rolling(200).mean()
        df_ma["ma_signal"] = (df_ma["ma50"] > df_ma["ma200"]).astype(int).shift(1)
        df_ma["ma_cost"] = df_ma["Open"]
        ma_patient = df_ma["ma_signal"] == 0
        df_ma.loc[ma_patient, "ma_cost"] = (
            df_ma.loc[ma_patient, "Open"] + df_ma.loc[ma_patient, "prior_close"]
        ) / 2
        df_ma = df_ma.dropna(subset=["ma_signal", "ma_cost", "prior_close"])
        ma_avg = safe_float(df_ma["ma_cost"].mean()) if len(df_ma) > 0 else twap_avg
        ma_saving = round((twap_avg - ma_avg) / twap_avg * 100, 3) if twap_avg != 0 and len(df_ma) > 0 else 0

        df_ma["next_return"] = df_ma["Close"].pct_change().shift(-1)
        df_ma = df_ma.dropna(subset=["next_return"])
        ma_correct = int(
            ((df_ma["ma_signal"] == 1) & (df_ma["next_return"] > 0)).sum() +
            ((df_ma["ma_signal"] == 0) & (df_ma["next_return"] < 0)).sum()
        )
        ma_hit_rate = round(ma_correct / len(df_ma) * 100, 1) if len(df_ma) > 0 else 0

        raw_p_values = [safe_float(p_value), safe_float(p_acc), perm_p_value]
        n_tests = len(raw_p_values)
        bonferroni_corrected = [min(p * n_tests, 1.0) for p in raw_p_values]

        return {
            "summary": {
                "twap_avg_cost":   round(twap_avg,   2),
                "regime_avg_cost": round(regime_avg, 2),
                "saving_pct":      saving_pct,
                "saving_ci_95":    [ci_low, ci_high],
                "n_days":          len(df),
                "method":          "walk-forward OOS" if use_walkforward else "in-sample (insufficient data for walk-forward)",
                "t_test_p_value":  round(safe_float(p_value), 4),
                "significant":     bool(p_value < 0.05),
                "permutation_p_value":  round(perm_p_value,   4),
                "permutation_percentile": round(perm_percentile, 1),
                "permutation_null_mean":  perm_null_mean,
                "permutation_null_std":   perm_null_std,
                "n_permutations":         1000,
                "bonferroni_corrected_p_values": [round(p, 4) for p in bonferroni_corrected],
                "n_hypothesis_tests": n_tests,
                "crash_days": regime_stats.get("crash", {}).get("days", 0),
                "crash_pct":  regime_stats.get("crash", {}).get("pct",  0.0),
                "n_states":   4,
            },
            "regime_stats":      regime_stats,
            "transition_matrix": trans_mat_ordered,
            "stability": {
                "n_transition_days":       n_transition_days,
                "pct_transition_days":     pct_transition_days,
                "low_confidence_threshold": LOW_CONFIDENCE_THRESHOLD,
                "high_conf_saving_pct":    hc_saving,
                "saving_lift_bps":         round((hc_saving - saving_pct) * 100, 1),
                "avg_confidence_by_regime": conf_by_regime,
            },
            "model_selection": model_selection_info,
            "regime_accuracy": {
                "overall_hit_rate":   overall_hit_rate,
                "bullish_hit_rate":   bullish_hit_rate,
                "bearish_hit_rate":   bearish_hit_rate,
                "bullish_n":          bullish_total,
                "bearish_n":          bearish_total,
                "total_predictions":  total_predictions,
                "vs_random_p_value":  round(safe_float(p_acc), 4),
                "better_than_random": bool(p_acc < 0.05),
            },
            "ma_baseline": {
                "saving_pct": ma_saving,
                "hit_rate":   ma_hit_rate,
                "avg_cost":   round(ma_avg, 2),
            },
            "regime_params": regime_params,
            "daily":         daily,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/intraday_backtest/{ticker}")
def get_intraday_backtest(ticker: str = "SPY", period: str = "1y"):
    try:
        days = {"3mo": 90, "6mo": 180, "1y": 365}.get(period, 365)

        daily_df = flatten_columns(fetch_data(ticker, period))
        states, confidence, model, scaler, daily_df = fit_hmm_4state(daily_df)
        states = smooth_regimes(states, min_duration=3)
        daily_df["regime"] = states
        daily_df["regime_signal"] = pd.Series(states, index=daily_df.index).shift(1)

        hourly_df = fetch_intraday(ticker, days=days)
        hourly_df.index = pd.to_datetime(hourly_df.index)

        cost_model = TransactionCostModel(ticker, daily_df)

        spread_mults = cost_model.measure_regime_spreads(daily_df, states)
        drift_per_regime = cost_model.measure_regime_drift(daily_df, states)

        cost_model.set_regime_spreads(spread_mults)
        cost_model.set_regime_drift(drift_per_regime)


        if hourly_df.index.tz is not None:
            hourly_df.index = hourly_df.index.tz_localize(None)
        if daily_df.index.tz is not None:
            daily_df.index = daily_df.index.tz_localize(None)

        hourly_df["date"] = hourly_df.index.date
        daily_df["date"] = daily_df.index.date

        start = hourly_df["date"].min()
        end   = hourly_df["date"].max()

        daily_df = daily_df[(daily_df["date"] >= start) & (daily_df["date"] <= end)]

        N_SLICES = 6
        fills = []

        for date, row in daily_df.iterrows():
            if pd.isna(row.get("regime_signal")):
                continue
            regime = int(row["regime_signal"])
            target_date = pd.Timestamp(date).date()
            day_mask = pd.to_datetime(hourly_df.index).normalize().date == target_date
            day_bars = hourly_df[day_mask]

            if len(day_bars) < 3:
                continue

            bars = day_bars.iloc[:N_SLICES]
            arrival_price = safe_float(bars.iloc[0]["Open"])
            volumes = bars["Volume"].values.astype(float)
            closes  = bars["Close"].values.astype(float)
            total_vol = volumes.sum()
            vwap_price = safe_float(np.average(closes, weights=volumes) if total_vol > 0 else closes.mean())

            n = len(bars)
            if regime == 2:
                raw_weights = np.array([n - i for i in range(n)], dtype=float)
            elif regime == 1:
                raw_weights = np.ones(n, dtype=float)
            else:
                raw_weights = np.array([i + 1 for i in range(n)], dtype=float)
            weights = raw_weights / raw_weights.sum()

            notional = 1_000_000
            shares = notional / arrival_price

            schedule = weights.tolist()

            costs = cost_model.compute_execution_cost(
                execution_schedule=schedule,
                total_shares=shares,
                regime=regime,
                intraday_prices=bars
            )

            total_cost_bps = costs["total_cost_bps"]

            executed_price = arrival_price * (1 + total_cost_bps / 10000)

            is_regime = total_cost_bps / 100 
            is_vwap   = (vwap_price    - arrival_price) / arrival_price * 100 if arrival_price != 0 else 0

            fills.append({
                "date":            str(date.date()),
                "regime":          regime,
                "arrival_price":   round(arrival_price,  4),
                "vwap_price":      round(vwap_price,     4),
                "executed_price":  round(executed_price, 4),
                "is_regime_pct":   round(is_regime,      4),
                "is_vwap_pct":     round(is_vwap,        4),
                "improvement_pct": round(is_vwap - is_regime, 4),
                "total_cost_bps": round(costs["total_cost_bps"], 2),
                "spread_cost_bps": round(costs["spread_cost_bps"], 2),
                "temporary_impact_bps": round(costs["temporary_impact_bps"], 2),
                "permanent_impact_bps": round(costs["permanent_impact_bps"], 2),
                "timing_cost_bps": round(costs["timing_cost_bps"], 2),
            })

        if len(fills) == 0:
            raise HTTPException(status_code=422, detail="No hourly/daily overlap found. Try period=1y.")

        df_fills = pd.DataFrame(fills)
        mean_improvement = safe_float(df_fills["improvement_pct"].mean())
        mean_is_regime   = safe_float(df_fills["is_regime_pct"].mean())
        mean_is_vwap     = safe_float(df_fills["is_vwap_pct"].mean())

        rng = np.random.default_rng(42)
        n_boot = len(df_fills)
        boot_impr = [
            df_fills["improvement_pct"].iloc[rng.integers(0, n_boot, size=n_boot)].mean()
            for _ in range(1000)
        ]
        ci_low  = round(safe_float(np.percentile(boot_impr, 2.5)),  4)
        ci_high = round(safe_float(np.percentile(boot_impr, 97.5)), 4)

        regime_breakdown = {}
        for r, label in [(0, "crash"), (1, "bearish"), (2, "transitional"), (3, "bullish")]:
            subset = df_fills[df_fills["regime"] == r]
            regime_breakdown[label] = {
                "n_fills":          len(subset),
                "mean_improvement": round(safe_float(subset["improvement_pct"].mean()), 4) if len(subset) else 0,
                "mean_is_regime":   round(safe_float(subset["is_regime_pct"].mean()),   4) if len(subset) else 0,
            }

        return {
            "summary": {
                "mean_improvement_pct": round(mean_improvement, 4),
                "mean_is_regime_pct":   round(mean_is_regime,   4),
                "mean_is_vwap_pct":     round(mean_is_vwap,     4),
                "ci_95":                [ci_low, ci_high],
                "n_fills":              len(fills),
                "n_slices":             N_SLICES,
                "ci_excludes_zero":     not (ci_low <= 0 <= ci_high),
            },
            "regime_breakdown": regime_breakdown,
            "fills":            fills,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transaction_costs/{ticker}")
def get_transaction_costs(ticker: str = "SPY", period: str = "1y"):
    try:
        daily_df = flatten_columns(fetch_data(ticker, period))
        hourly_df = fetch_intraday(ticker, days=365)

        states, _, _, _, daily_df = fit_hmm(daily_df)
        states = smooth_regimes(states, min_duration=3)

        cost_model = TransactionCostModel(ticker, daily_df)

        results = []

        for date in daily_df.index[-30:]: 
            regime = int(states[daily_df.index.get_loc(date)])

            day_bars = hourly_df[hourly_df.index.date == date.date()]
            if len(day_bars) < 6:
                continue

            schedule = cost_model._get_regime_schedule(regime)

            shares = 1_000_000 / day_bars.iloc[0]["Open"]

            costs = cost_model.compute_execution_cost(
                schedule, shares, regime, day_bars
            )

            results.append({
                "date": str(date.date()),
                **costs
            })

        return {
            "ticker": ticker,
            "results": results
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/compare")
def compare_regimes(period: str = "6mo"):
    from concurrent.futures import ThreadPoolExecutor, as_completed

    ALL_TICKERS = ["SPY", "QQQ", "IWM", "BTC", "ETH", "GLD", "TLT", "AAPL"]

    def process_ticker(ticker):
        try:
            df = fetch_data(ticker, period)
            if df.empty or len(df) < 30:
                return ticker, {"error": "Not enough data"}

            df = flatten_columns(df)

            required = ["Open", "High", "Low", "Close", "Volume"]
            missing = [c for c in required if c not in df.columns]
            if missing:
                return ticker, {"error": f"Missing columns: {missing}"}

            states, confidence, model, scaler, df = fit_hmm_4state(df)
            if states is None or model is None:
                return ticker, {"error": "HMM fit failed"}

            states = smooth_regimes(states, min_duration=3)
            df["regime"] = states
            df["returns"] = df["Close"].pct_change()

            n = len(states)
            switches = int(np.sum(np.diff(states) != 0))

            regime_stats = {}
            for r, label in [(0, "crash"), (1, "bearish"), (2, "transitional"), (3, "bullish")]:
                mask = df["regime"] == r
                days = int(mask.sum())
                regime_stats[label] = {
                    "days": days,
                    "pct":               round(safe_float(days / n * 100), 1),
                    "ann_vol":           round(safe_float(df.loc[mask, "returns"].std() * np.sqrt(252) * 100), 2),
                    "mean_daily_return": round(safe_float(df.loc[mask, "returns"].mean() * 100), 4),
                }

            prices = [
                {
                    "date":   str(date.date()),
                    "close":  round(safe_float(row["Close"]), 2),
                    "regime": int(row["regime"]),
                }
                for date, row in df.iterrows()
                if not np.isnan(float(row["Close"]))
            ]

            return ticker, {
                "n_days":             n,
                "n_switches":         switches,
                "avg_duration_days":  round(safe_float(n / (switches + 1)), 1),
                "switches_per_month": round(safe_float(switches / (n / 21)), 2),
                "regime_stats":       regime_stats,
                "prices":             prices,
            }

        except Exception as e:
            traceback.print_exc()
            return ticker, {"error": str(e)}

    results = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_ticker, t): t for t in ALL_TICKERS}
        for future in as_completed(futures):
            ticker, result = future.result()
            results[ticker] = result

    return results

@app.get("/api/shap/{ticker}")
def get_shap_explanation(ticker: str = "SPY", period: str = "1y", n_days: int = 1):
    """
    Return SHAP feature attributions for the most recent n_days regime classifications.

    Response shape:
      shap_values[day][feature][state] - contribution of feature to P(state) for that day
      features_today[day][feature]     - raw feature values
      base_values[state]               - expected P(state) across background
      predicted_state                  - ordered state (0=crash .. 3=bullish)
      state_probs[state]               - posterior P(state) for latest day
    """
    try:
        df = flatten_columns(fetch_data(ticker, period))
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        if model is None or scaler is None:
            raise HTTPException(status_code=500, detail="HMM fit failed - cannot run SHAP")

        df["returns"]    = df["Close"].pct_change()
        df["volatility"] = df["returns"].rolling(10).std()
        df["momentum"]   = df["Close"].pct_change(5)
        df["trend"]      = df["Close"] / df["Close"].rolling(20).mean() - 1
        df["drawdown"]   = df["Close"] / df["Close"].cummax() - 1

        if "volume" not in df.columns and "Volume" in df.columns:
            df["volume"] = df["Volume"]

        df["log_volume"] = np.log(df["volume"])
        df["volume_z"]   = (
            df["log_volume"] - df["log_volume"].rolling(20).mean()
        ) / df["log_volume"].rolling(20).std()
        df["volume_lead"] = df["volume_z"].shift(1)

        features_df = df[["returns", "volatility", "momentum", "trend", "drawdown", "volume_lead"]].dropna()

        if len(features_df) < 30:
            raise HTTPException(status_code=400, detail="Not enough feature rows after preprocessing")

        n_days_clamped = max(1, min(n_days, 5)) 

        result = explain_regime_shap(
            model=model,
            scaler=scaler,
            features_df=features_df,
            state_map=model._state_map,
            n_background=50,
            n_explain=n_days_clamped,
        )

        explained_dates = [str(d.date()) for d in features_df.index[-n_days_clamped:]]
        result["dates"] = explained_dates
        result["ticker"] = ticker.upper()

        current_state = result["predicted_state"]
        result["current_regime_label"] = result["state_labels"][current_state]

        def sanitize(obj):
            if isinstance(obj, float):
                return safe_float(obj)
            if isinstance(obj, list):
                return [sanitize(v) for v in obj]
            return obj

        result["shap_values"] = sanitize(result["shap_values"])
        result["base_values"] = sanitize(result["base_values"])
        result["features_today"] = sanitize(result["features_today"])
        result["state_probs"] = sanitize(result["state_probs"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
import time as _time
_model_cache: dict = {}
_CACHE_TTL = 900

def _get_cached_fit(ticker: str, period: str):
    """Refit only if cache is stale. Prevents HMM refit on every snapshot call."""
    key = f"{ticker}::{period}"
    entry = _model_cache.get(key)
    if entry and (_time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    df = flatten_columns(fetch_data(ticker, period))
    if df.empty or len(df) < 30:
        return None
    result = fit_hmm_4state(df)
    _model_cache[key] = {"data": result, "ts": _time.time()}
    return result


@app.get("/api/snapshot/{ticker}")
def get_snapshot(ticker: str = "SPY", period: str = "1y"):
    """
    Fast endpoint for paper trading tab.
    Returns: regime, confidence, latest price, SHAP top driver.
    Uses cached HMM - <1s after first call, ~5s cold (SHAP).
    """
    try:
        result = _get_cached_fit(ticker, period)
        if result is None:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = result
        if states is None or model is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)
        current_regime = int(states[-1])
        current_conf   = round(safe_float(confidence[-1]), 3)
        latest_close   = round(safe_float(df["Close"].iloc[-1]), 4)
        latest_date    = str(df.index[-1].date())
        rec            = get_recommendation_4state(current_regime)

        top_driver = "-"
        try:
            df2 = df.copy()
            df2["returns"]     = df2["Close"].pct_change()
            df2["volatility"]  = df2["returns"].rolling(10).std()
            df2["momentum"]    = df2["Close"].pct_change(5)
            df2["trend"]       = df2["Close"] / df2["Close"].rolling(20).mean() - 1
            df2["drawdown"]    = df2["Close"] / df2["Close"].cummax() - 1
            if "volume" not in df2.columns and "Volume" in df2.columns:
                df2["volume"] = df2["Volume"]
            df2["log_volume"]  = np.log(df2["volume"])
            df2["volume_z"]    = (
                df2["log_volume"] - df2["log_volume"].rolling(20).mean()
            ) / df2["log_volume"].rolling(20).std()
            df2["volume_lead"] = df2["volume_z"].shift(1)

            features_df = df2[[
                "returns", "volatility", "momentum",
                "trend", "drawdown", "volume_lead"
            ]].dropna()

            if len(features_df) >= 30 and scaler is not None:
                shap_result = explain_regime_shap(
                    model=model, scaler=scaler,
                    features_df=features_df,
                    state_map=model._state_map,
                    n_background=30,
                    n_explain=1,
                )
                predicted  = shap_result["predicted_state"]
                shap_day   = shap_result["shap_values"][0] 
                feat_names = shap_result["feature_names"]
                feat_vals  = shap_result["features_today"][0]

                abs_shaps  = [abs(shap_day[fi][predicted]) for fi in range(len(feat_names))]
                top_idx    = int(np.argmax(abs_shaps))
                top_val    = shap_day[top_idx][predicted]
                top_raw    = feat_vals[top_idx]
                top_name   = feat_names[top_idx]
                sign       = "+" if top_val >= 0 else ""
                top_driver = f"{top_name} {sign}{top_val:.3f} (raw {top_raw:.4f})"

        except Exception as shap_err:
            print(f"[snapshot] SHAP non-fatal: {shap_err}")

        return {
            "ticker":         ticker.upper(),
            "date":           latest_date,
            "current_regime": current_regime,
            "regime_label":   rec["regime"],
            "regime_color":   rec["color"],
            "confidence":     current_conf,
            "latest_price":   latest_close,
            "top_driver":     top_driver,
            "action":         rec["action"],
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/outcome/{ticker}")
def get_outcome(ticker: str = "SPY", period: str = "1y"):
    """
    Lightweight outcome check for paper trading.
    Returns only: current regime, regime label, latest price.
    Uses cached HMM - no backtest, no permutation tests.
    """
    try:
        result = _get_cached_fit(ticker, period)
        if result is None:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = result
        if states is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)
        current_regime = int(states[-1])
        current_conf   = round(safe_float(confidence[-1]), 3)
        latest_close   = round(safe_float(df["Close"].iloc[-1]), 4)
        latest_date    = str(df.index[-1].date())
        rec            = get_recommendation_4state(current_regime)

        return {
            "ticker":         ticker.upper(),
            "date":           latest_date,
            "current_regime": current_regime,
            "regime_label":   rec["regime"],
            "latest_price":   latest_close,
            "confidence":     current_conf,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/vol_forecast/{ticker}")
def get_vol_forecast(ticker: str = "SPY", period: str = "6mo"):
    try:
        df = flatten_columns(fetch_data(ticker, period))
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        if states is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)

        df["returns"] = df["Close"].pct_change()
        df.dropna(subset=["returns"], inplace=True)

        returns = df["returns"].values
        regime_labels = states[-len(returns):]
        current_regime = int(states[-1])

        result = forecast_conditional_vol(
            returns=returns,
            regimes=regime_labels,
            current_regime=current_regime,
            horizon=5,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/changepoint/{ticker}")
def get_changepoint(ticker: str = "SPY", period: str = "6mo"):
    try:
        df = flatten_columns(fetch_data(ticker, period))
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        if states is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)
        df["returns"] = df["Close"].pct_change()
        df.dropna(subset=["returns"], inplace=True)

        returns = df["returns"].values
        hmm_states = states[-len(returns):]
        dates = [str(d.date()) for d in df.index]

        result = run_changepoint_analysis(
            returns=returns,
            hmm_states=hmm_states,
            dates=dates,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/macro_attribution")
def get_macro_attribution(ticker: str = "SPY", period: str = "6mo", api_key: str = ""):
    fred_key = api_key or os.environ.get("FRED_API_KEY", "")
    try:
        df = flatten_columns(fetch_data(ticker, period))
        if df.empty or len(df) < 60:
            raise HTTPException(status_code=400, detail="Not enough data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        if states is None:
            raise HTTPException(status_code=500, detail="HMM fit failed")

        states = smooth_regimes(states, min_duration=3)
        dates  = [str(d.date()) for d in df.index]
        hmm_states = states[-len(dates):]

        result = run_macro_attribution(
            regime_dates=dates,
            regime_states=hmm_states,
            api_key=fred_key,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))