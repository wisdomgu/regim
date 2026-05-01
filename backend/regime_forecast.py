"""
backend/regime_forecast.py
──────────────────────────
Add to main.py:
    from regime_forecast import router as forecast_router
    app.include_router(forecast_router)

Or copy the single endpoint directly into main.py.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from regime import fit_hmm_4state, smooth_regimes
from data import fetch_data
import datetime
import pandas as pd

router = APIRouter()

REGIME_ORDER = ["crash", "bearish", "transitional", "bullish"]
HORIZONS = [1, 2, 3, 5, 10, 21]


class RegimeForecastResponse(BaseModel):
    transition_matrix: list[list[float]]     
    current_state: int              
    current_state_vector: list[float]     
    forecast_distributions: list[list[float]] 
    forecast_horizons: list[int]
    ticker: str
    as_of: str


def _mat_pow(A: np.ndarray, n: int) -> np.ndarray:
    """Raise square matrix A to the n-th power via repeated squaring."""
    result = np.eye(A.shape[0])
    base = A.copy()
    while n > 0:
        if n % 2 == 1:
            result = result @ base
        base = base @ base
        n //= 2
    return result


def _forecast_distributions(
    trans_matrix: np.ndarray,
    state_vector: np.ndarray,
    horizons: list[int],
) -> list[list[float]]:
    """
    P(regime at t+h) = state_vector @ A^h
    Returns list of probability vectors, one per horizon.
    """
    out = []
    for h in horizons:
        Ah = _mat_pow(trans_matrix, h)
        dist = state_vector @ Ah        
        dist = np.clip(dist, 0, 1)
        dist /= dist.sum()     
        out.append(dist.tolist())
    return out


def _build_mock_response(ticker: str) -> RegimeForecastResponse:
    """
    Fallback response when the HMM backend is unavailable.
    Uses a realistic but synthetic transition matrix (bullish bias).
    """
    import datetime

    trans = np.array([
        [0.80, 0.15, 0.04, 0.01], 
        [0.10, 0.75, 0.10, 0.05],
        [0.03, 0.10, 0.75, 0.12],  
        [0.01, 0.05, 0.10, 0.84],
    ])

    state_vec = np.array([0.02, 0.08, 0.15, 0.75])
    current_state = int(np.argmax(state_vec))

    dists = _forecast_distributions(trans, state_vec, HORIZONS)

    return RegimeForecastResponse(
        transition_matrix=trans.tolist(),
        current_state=current_state,
        current_state_vector=state_vec.tolist(),
        forecast_distributions=dists,
        forecast_horizons=HORIZONS,
        ticker=ticker,
        as_of=str(datetime.date.today()),
    )


@router.get("/api/regime_forecast", response_model=RegimeForecastResponse)
async def regime_forecast(
    ticker: str = Query("SPY"),
    period: str = Query("6mo"),
) -> RegimeForecastResponse:
    try:
        df = fetch_data(ticker, period)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        if df is None or len(df) < 30:
            raise ValueError("Insufficient data")

        states, confidence, model, scaler, df = fit_hmm_4state(df)
        states = smooth_regimes(states, min_duration=3)

        if model is None:
            return _build_mock_response(ticker)

        n = model.n_components
        A_raw = model.transmat_

        state_order = model._state_order

        A_ordered = A_raw[np.ix_(state_order, state_order)]

        features_df = df[[
            "returns", "volatility", "momentum",
            "trend", "drawdown", "volume_lead"
        ]].dropna()

        if len(features_df) > 0 and scaler is not None:
            scaled = scaler.transform(features_df.values)

            if np.any(np.isnan(scaled)) or np.any(np.isinf(scaled)):
                raise ValueError("Scaled features contain NaN/inf")

            posteriors = model.predict_proba(scaled)
            posteriors = posteriors[:, model._state_order]

            last_posterior = posteriors[-1]

        else:
            current_hard = int(states[-1])
            last_posterior = np.zeros(model.n_components)
            last_posterior[current_hard] = 1.0


        last_posterior = np.nan_to_num(last_posterior, nan=0.0)

        total = last_posterior.sum()
        if total <= 0:
            fallback_state = int(states[-1])
            last_posterior = np.zeros(model.n_components)
            last_posterior[fallback_state] = 1.0
        else:
            last_posterior /= total

        states = smooth_regimes(states, min_duration=3)
        current_hard = int(states[-1]) 

        dists = _forecast_distributions(A_ordered, last_posterior, HORIZONS)

        return RegimeForecastResponse(
            transition_matrix=A_ordered.tolist(),
            current_state=current_hard,
            current_state_vector=last_posterior.tolist(),
            forecast_horizons=HORIZONS,
            forecast_distributions=dists,
            ticker=ticker,
            as_of=str(datetime.date.today()),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Regime forecast failed for {ticker}: {exc}",
        ) from exc