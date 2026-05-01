# Regim
> A quantitative finance research platform studying whether market regime signals
> can improve trade execution, and the conditions under which they fail.

**Live demo:** [regim-dashboard.vercel.app](https://regim-dashboard.vercel.app) &nbsp;·&nbsp;
**Findings:** [regim-dashboard.vercel.app/findings](https://regim-dashboard.vercel.app/findings) &nbsp;·&nbsp;
**Companion paper (SSRN, forthcoming):** *Temporal Aggregation Reveals HMM Regime Uncertainty Signals in Optimal Trade Execution*

---

## Eight Key Findings

All reproducible from the live dashboard. Statistical tests: paired t-test, 1000-iteration permutation test, binomial test, Bonferroni corrected across simultaneous hypotheses.

| # | Finding | Evidence |
|---|---------|----------|
| 1 | RL fails to exploit regime information | PPO policy inversion across seeds; WAP 1.0003 vs hand-coded rule's 0.9949 |
| 2 | Crash regime requires completely different execution than bearish | 1.3–2× vol ratio; halt-and-wait vs patient limits |
| 3 | High-confidence signals outperform; ~23% of days show no edge | Transition zone filtering lifts performance |
| 4 | Signal significance confirmed by permutation testing | 1000 shuffled-label permutations; observed savings above empirical null |
| 5 | Regime-conditional GARCH reduces 5-day vol forecast RMSE | +58.6% reduction vs unconditional full-series baseline |
| 6 | Bayesian changepoint detection leads HMM Viterbi by 1.5 days | 63.2% of transitions detected in advance (PELT algorithm) |
| 7 | Macro fundamentals confirm statistical regimes | VIX ρ = −0.805; crash avg VIX 24.6 vs 10.3 in bullish |
| 8 | BIC covariance selection is asset-dependent | Optimal HMM structure differs: equities ≠ crypto ≠ bonds |

**From the companion paper** (cross-asset study, 8 assets, 5 evaluation horizons):

- Daily-resolution HMM signals are universally uninformative (no individual asset significant at W=1)
- Signals emerge at 3-day aggregation and strengthen monotonically to 10 days
- IWM entropy: Spearman ρ = −0.454 (p < 0.001, bootstrap CI [−0.555, −0.347], 100% of 1000 resamples negative)
- SPY entropy: ρ = −0.166 (p = 0.018, 98.8% of resamples negative)
- BTC stay probability: ρ = −0.155 (p = 0.004, 100% of resamples negative)

---

## Dashboard

Live at [regim.vercel.app/dashboard](https://regim.vercel.app/dashboard). Supports 8 assets across 3 time periods and 3 execution profiles.

**Assets:** SPY · QQQ · IWM (equity indices) · BTC · ETH (crypto) · GLD (commodity) · TLT (bonds) · AAPL (large-cap)

**Time periods:** 3mo · 6mo · 1y

**Execution profiles:** Retail · Institutional · Systematic

### Dashboard Tabs

**Live Regime**: Real-time 4-state HMM classification with regime probability chart, transition matrix, SHAP feature attribution (which features are driving the current classification), and forward-looking regime forecast across horizons up to 50+ days. Current regime, stay probability, switch probability, and expected duration derived from the fitted transition matrix, directly comparable to CTMSTOU calibrated rates.

**Backtest**: Walk-forward out-of-sample backtest comparing regime-aware execution against TWAP. Includes confidence threshold filter (only act on signals above a threshold; below → fall back to TWAP), regime direction accuracy, HMM vs 50/200 MA crossover comparison, transition zone analysis, annualized Sharpe ratios by regime, and full transaction cost breakdown (spread, temporary impact, permanent impact, timing).

**Paper vs Reality**: Places CTMSTOU simulation parameters directly against empirically learned HMM statistics for SPY. Side-by-side: mean return/day, volatility, momentum for paper bullish/bearish vs real SPY bullish/bearish/transitional. Execution cost comparison: paper's WAP 0.9949 (regime rule) vs 1.0277 (TWAP) against real SPY backtest results.

**Comparison**: Cross-asset regime structure comparison. Select any 2 assets; dashboard shows regime switches, switches/month, avg regime duration, % time in each state, vol by regime, and regime persistence bars across all 8 assets: directly illustrating why the paper finds asset-class-heterogeneous results.

**Intraday Sim**: Order sliced into 6 hourly tranches. Regime-aware intraday weights (front-load in bullish, back-load in bearish) vs VWAP benchmark. Mean IS improvement −0.154% (95% CI [−0.183, −0.127], CI excludes zero, statistically significant). 1220 fills across 6 hourly slices/day.

**Statistics**: Every p-value, confidence interval, and permutation result in one place. Execution cost improvement (paired t-test + bootstrap CI n=1000 + permutation test), regime direction accuracy (binomial test vs 50% baseline), HMM vs MA crossover comparison, regime stability and transition zone metrics. All derived from walk-forward OOS labels.

**Paper Trading**: Log simulated trades against live regime signals. Records ticker, regime, confidence, SHAP top driver, direction, price, outcome date. Calls `/api/outcome` for auto-resolution. Tracks whether HMM predictions hold out-of-sample over time.

---

## Architecture

```
Yahoo Finance (yfinance)
        │
        ▼
   data.py  ──────────────────────────────────────────────────────────┐
        │                                                              │
        ▼                                                              ▼
  regime.py                                                    macro_attribution.py
  4-state Gaussian HMM                                         FRED API integration
  BIC covariance selection                                     Logistic regression
  40 random seeds                                              VIX / yield curve / CPI
  min 3% state occupancy                                               │
        │                                                              │
   ┌────┴────────────────────────┐                                     │
   ▼                             ▼                                     │
changepoint.py            vol_forecast.py                              │
PELT algorithm            GARCH(1,1) per regime                        │
vs HMM Viterbi            Regime-conditional                           │
1.5d median lead          vs unconditional baseline                    │
   │                             │                                     │
   └─────────────────┬───────────┘─────────────────────────────────────┘
                     │
                     ▼
               main.py (FastAPI)
               11 API endpoints
                     │
                     ▼
            Next.js 14 Dashboard
            TypeScript · Recharts
            7 analysis tabs
```

**Regime detection:** 4-state Gaussian HMM (crash / bearish / transitional / bullish) fitted on 6 price-volume features. States ordered by return-volatility score (φᵢ = μᵣ + μᵧ) for consistent cross-asset labeling. Crash distinguished from bearish by volatility, the two lowest-scoring states, since crash vol is 1.3–2× higher with completely different execution implications. BIC selects between full and diagonal covariance per asset. 40 random seeds with best-scoring model that passes 3% minimum state occupancy.

**Execution model:** Walk-forward OOS backtest with one-day signal lag (prior day's regime used for next-day execution). Crash → halt/minimum size. Bearish/Transitional → patient limit orders (midpoint of open and prior close). Bullish → aggressive, use open (same as TWAP). Implementation shortfall vs TWAP as primary cost metric.

**Validation:** Three simultaneous hypothesis tests (paired t-test, permutation test n=1000 shuffled regime labels, binomial test for direction accuracy) with Bonferroni correction.

**SHAP explainability:** KernelExplainer on HMM posterior probabilities to surface which features (returns, volatility, momentum, trend, drawdown, volume) drive each regime classification on each day.

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/regime` | Current regime, posterior, transition matrix, SHAP values |
| `GET /api/backtest` | Walk-forward OOS backtest vs TWAP with confidence filtering |
| `GET /api/backtest_4state` | Per-regime performance breakdown |
| `GET /api/changepoint` | PELT changepoints vs HMM Viterbi path with lead/lag table |
| `GET /api/compare` | Cross-asset regime structure comparison |
| `GET /api/intraday_backtest` | 6-tranche intraday IS improvement |
| `GET /api/macro_attribution` | FRED macro correlations and logistic regression |
| `GET /api/outcome` | Paper trading outcome resolution |
| `GET /api/regime_forecast` | Regime probability evolution across horizons |
| `GET /api/shap` | SHAP feature importance for regime classification |
| `GET /api/vol_forecast` | Regime-conditional GARCH(1,1) vs unconditional |

All endpoints accept `ticker` and `period` query params. Responses are cached.

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Regime detection | `hmmlearn` | 4-state Gaussian HMM |
| Explainability | `shap` | KernelExplainer on HMM posteriors |
| Changepoint detection | `ruptures` | PELT algorithm |
| Volatility | `arch` | GARCH(1,1) per regime |
| Macro data | `fredapi` | FRED API integration |
| Backend | FastAPI + Python 3.11 | 11 REST endpoints |
| Frontend | Next.js 14, TypeScript | Dashboard |
| Charts | Recharts | All visualizations |
| Deployment | Vercel + Railway | Frontend + backend |

---

## Running Locally

**Prerequisites:** Python 3.11+, Node.js 18+, free [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html)

**Backend**
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
# Add your FRED API key to .env
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). The dashboard will connect to your local backend.

**Research pipeline**
```bash
cd research
pip install -r requirements.txt
python run_analysis.py          # Full cross-asset analysis (~15 min)
python seed_robustness_test.py  # Bootstrap stability (n=1000)
```

---
