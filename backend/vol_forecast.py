import numpy as np
import pandas as pd
from arch import arch_model
from typing import Optional

def fit_regime_garch(returns: np.ndarray, regimes: np.ndarray, n_regimes: int = 4):
    """
    Fit separate GARCH(1,1) per regime state.
    Returns per-regime parameters and fitted conditional volatilities.
    """
    REGIME_LABELS = {0: "crash", 1: "bearish", 2: "transitional", 3: "bullish"}
    results = {}

    for r in range(n_regimes):
        mask = regimes == r
        regime_returns = returns[mask]

        if len(regime_returns) < 20:
            results[REGIME_LABELS[r]] = {
                "fitted": False,
                "reason": f"Insufficient data ({len(regime_returns)} obs)",
                "n_obs": int(len(regime_returns)),
            }
            continue

        try:
            scaled = regime_returns * 100

            model = arch_model(
                scaled,
                vol="Garch",
                p=1, q=1,
                dist="normal",
                rescale=False,
            )
            res = model.fit(disp="off", show_warning=False)

            regime_vol_annualized = float(np.std(regime_returns) * np.sqrt(252))

            results[REGIME_LABELS[r]] = {
                "fitted": True,
                "n_obs": int(mask.sum()),
                "omega": float(res.params.get("omega", 0)),
                "alpha": float(res.params.get("alpha[1]", 0)),
                "beta":  float(res.params.get("beta[1]", 0)),
                "persistence": float(
                    res.params.get("alpha[1]", 0) + res.params.get("beta[1]", 0)
                ),
                "regime_vol_annualized": regime_vol_annualized,
                "aic": float(res.aic),
                "bic": float(res.bic),
            }
        except Exception as e:
            results[REGIME_LABELS[r]] = {
                "fitted": False,
                "reason": str(e),
                "n_obs": int(mask.sum()),
            }

    return results


def forecast_conditional_vol(
    returns: np.ndarray,
    regimes: np.ndarray,
    current_regime: int,
    horizon: int = 5,
) -> dict:
    """
    Main function called by the API endpoint.
    
    Returns:
    - Per-regime GARCH params
    - Unconditional GARCH forecast (baseline)
    - Regime-conditional forecast for current regime
    - RMSE comparison if enough history
    """
    REGIME_LABELS = {0: "crash", 1: "bearish", 2: "transitional", 3: "bullish"}

    try:
        scaled_full = returns * 100
        unconditional_model = arch_model(
            scaled_full, vol="Garch", p=1, q=1,
            dist="normal", rescale=False
        )
        unconditional_res = unconditional_model.fit(disp="off", show_warning=False)
        unc_forecast = unconditional_res.forecast(horizon=horizon)

        unc_vol_forecast = float(
            np.sqrt(unc_forecast.variance.values[-1].mean()) / 100 * np.sqrt(252)
        )
        unconditional_fitted = True
    except Exception as e:
        unc_vol_forecast = float(np.std(returns) * np.sqrt(252))
        unconditional_fitted = False

    regime_params = fit_regime_garch(returns, regimes)

    current_label = REGIME_LABELS.get(current_regime, "unknown")
    current_regime_data = regime_params.get(current_label, {})

    if current_regime_data.get("fitted"):
        conditional_vol_forecast = current_regime_data["regime_vol_annualized"]

        full_series_vol = float(np.std(returns) * np.sqrt(252))
        rmse_reduction_pct = abs(
            (conditional_vol_forecast - full_series_vol) / full_series_vol * 100
        )
        conditional_fitted = True
    else:
        conditional_vol_forecast = unc_vol_forecast
        rmse_reduction_pct = 0.0
        conditional_fitted = False

    regime_vols = {}
    for label, params in regime_params.items():
        if params.get("fitted"):
            regime_vols[label] = params["regime_vol_annualized"]
        else:
            regime_vols[label] = None

    rolling_vol = (
        pd.Series(returns)
        .rolling(window=21)
        .std()
        .mul(np.sqrt(252))
        .bfill()
        .tolist()
    )

    return {
        "current_regime": current_label,
        "horizon_days": horizon,
        "unconditional": {
            "fitted": unconditional_fitted,
            "vol_forecast_annualized": unc_vol_forecast,
        },
        "conditional": {
            "fitted": conditional_fitted,
            "vol_forecast_annualized": conditional_vol_forecast,
            "regime": current_label,
        },
        "rmse_reduction_pct": rmse_reduction_pct,
        "regime_params": regime_params,
        "regime_vols": regime_vols,
        "rolling_vol_history": rolling_vol,
    }