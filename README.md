# Regim — Market Regime Detection & Optimal Execution Research System

> A quantitative finance research platform studying whether market regime signals
> can improve trade execution — and the conditions under which they fail.

**Live demo:** [regim.vercel.app](https://regim.vercel.app) &nbsp;·&nbsp;
**Findings:** [regim.vercel.app/findings](https://regim.vercel.app/findings) &nbsp;·&nbsp;
**Companion paper (SSRN, forthcoming):** *Temporal Aggregation Reveals HMM Regime Uncertainty Signals in Optimal Trade Execution*

---

## The Research Question

Institutional traders adapt execution strategy to market regimes: buy aggressively when prices are trending up, use patient limit orders when they're falling. Hidden Markov Models are the standard tool for detecting these regimes. Two empirical questions have gone unanswered:

1. **Can reinforcement learning agents learn to exploit regime signals?**
2. **Do HMM confidence scores actually predict execution quality on real assets?**

This system investigates both on real market data across 8 asset classes. The answers are not what the simulation literature predicts.

**On question 1:** PPO agents cannot reliably learn regime-aware execution. Training converges to qualitatively different policies across random seeds — sometimes producing *inverted* regime sensitivity, executing more aggressively in bear markets than bull. The failure is structural, not informational. Hard-coded regime conditioning bypasses an optimization problem that standard policy gradient methods cannot solve.

**On question 2:** HMM confidence signals *do* predict execution quality — but only after 3–10 day temporal aggregation. At daily resolution, no signal is informative for any asset. The regime-driven component of execution cost is obscured by single-day noise and only becomes detectable when averaged over multiple days, a threshold that aligns with empirical mean regime durations.

---

## Eight Key Findings

All reproducible from the live dashboard. Statistical tests: paired t-test, 1000-iteration permutation test, binomial test — Bonferroni corrected across simultaneous hypotheses.

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

**Live Regime** — Real-time 4-state HMM classification with regime probability chart, transition matrix, SHAP feature attribution (which features are driving the current classification), and forward-looking regime forecast across horizons up to 50+ days. Current regime, stay probability, switch probability, and expected duration derived from the fitted transition matrix — directly comparable to CTMSTOU calibrated rates.

**Backtest** — Walk-forward out-of-sample backtest comparing regime-aware execution against TWAP. Includes confidence threshold filter (only act on signals above a threshold; below → fall back to TWAP), regime direction accuracy, HMM vs 50/200 MA crossover comparison, transition zone analysis, annualized Sharpe ratios by regime, and full transaction cost breakdown (spread, temporary impact, permanent impact, timing).

**Paper vs Reality** — Places CTMSTOU simulation parameters directly against empirically learned HMM statistics for SPY. Side-by-side: mean return/day, volatility, momentum for paper bullish/bearish vs real SPY bullish/bearish/transitional. Execution cost comparison: paper's WAP 0.9949 (regime rule) vs 1.0277 (TWAP) against real SPY backtest results.

**Comparison** — Cross-asset regime structure comparison. Select any 2 assets; dashboard shows regime switches, switches/month, avg regime duration, % time in each state, vol by regime, and regime persistence bars across all 8 assets — directly illustrating why the paper finds asset-class-heterogeneous results.

**Intraday Sim** — Order sliced into 6 hourly tranches. Regime-aware intraday weights (front-load in bullish, back-load in bearish) vs VWAP benchmark. Mean IS improvement −0.154% (95% CI [−0.183, −0.127], CI excludes zero — statistically significant). 1220 fills across 6 hourly slices/day.

**Statistics** — Every p-value, confidence interval, and permutation result in one place. Execution cost improvement (paired t-test + bootstrap CI n=1000 + permutation test), regime direction accuracy (binomial test vs 50% baseline), HMM vs MA crossover comparison, regime stability and transition zone metrics. All derived from walk-forward OOS labels.

**Paper Trading** — Log simulated trades against live regime signals. Records ticker, regime, confidence, SHAP top driver, direction, price, outcome date. Calls `/api/outcome` for auto-resolution. Tracks whether HMM predictions hold out-of-sample over time.

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
  min 3% state occupancy                                              │
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

**Regime detection:** 4-state Gaussian HMM (crash / bearish / transitional / bullish) fitted on 6 price-volume features. States ordered by return-volatility score (φᵢ = μᵣ + μᵧ) for consistent cross-asset labeling. Crash distinguished from bearish by volatility — the two lowest-scoring states — since crash vol is 1.3–2× higher with completely different execution implications. BIC selects between full and diagonal covariance per asset. 40 random seeds with best-scoring model that passes 3% minimum state occupancy.

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

## Research Paper

The `research/` directory contains the full analysis pipeline for the companion paper: *Temporal Aggregation Reveals HMM Regime Uncertainty Signals in Optimal Trade Execution* (SSRN forthcoming).

```
research/
├── analysis_core.py          # Core HMM fitting and signal computation
├── data_collector.py         # Cross-asset data collection (8 assets)
├── rolling_window_test.py    # Multi-horizon Spearman correlation tests
├── alt_execution_test.py     # Alternative execution model sensitivity
├── seed_robustness_test.py   # Bootstrap stability (1000 resamples)
├── run_analysis.py           # Main pipeline entry point
├── report.py                 # Results table generation
├── plotting.py               # Figure generation (Figures 1 & 2)
├── test.py                   # Unit tests
├── data/                     # Cached OHLCV data
├── figures/                  # Generated plots
└── results/                  # Output tables
```

Key results: At 10-day aggregation, raw posterior entropy predicts execution quality for equity indices (IWM ρ = −0.454, SPY ρ = −0.166); regime stay probability predicts for cryptocurrency (BTC ρ = −0.155). Bootstrap stability: 98.8–100% of 1000 resamples produce the expected sign for all three primary findings. Daily-resolution signals are uninformative for all 8 assets.

**Note:** The `research/` scripts share feature engineering logic with `backend/regime.py` but are self-contained and do not import from the backend at runtime. They can be run independently.

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

## Paper References

| Role | Citation |
|------|----------|
| Primary (validated & extended) | Amrouni et al. (2022) — CTMSTOU simulation framework |
| Execution model | Almgren & Chriss (2000) — Optimal execution of portfolio transactions |
| Changepoint detection | Killick, Fearnhead & Eckley (2012) — PELT algorithm |
| Explainability | Lundberg & Lee (2017) — SHAP |
| HMM foundation | Hamilton (1989) — Markov-switching models |
| Execution cost metric | Perold (1988) — Implementation shortfall |

---

*Built by Satish Garg*