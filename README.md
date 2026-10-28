# Regim
> A quantitative finance research platform investigating if market regime signal can improve trade execution and the conditions under which they fail.

**Live demo:** [regim-dashboard.vercel.app](https://regim-dashboard.vercel.app) &nbsp;·&nbsp;
**Findings:** [regim-dashboard.vercel.app/findings](https://regim-dashboard.vercel.app/findings)

---

**Assets:** SPY · QQQ · IWM (equity indices) · BTC · ETH (crypto) · GLD (commodity) · TLT (bonds) · AAPL (large-cap)

**Time periods:** 3mo · 6mo · 1y

**Execution profiles:** Retail · Institutional · Systematic

---

### Dashboard Tabs

**Live Regime**: Real-time 4-state HMM classification (with regime probability chart), transition matrix & SHAP feature attribution (“Which features are driving our current classification?”) with forward-looking regime forecast.

**Backtest**: Walk-forward OOS backtesting of regime-aware execution vs TWAP.

**Paper vs Reality**: CTMSTOU simulation parameters vs empirically-learned HMM stats for SPY.

**Comparison**: Cross asset regime structure comparisons.

**Intraday Sim**: orders sliced into 6 hourly tranches.

**Statistics**: All your stats (p values, confidence intervals & permutations) in one place.

**Paper Trading**: Log simulated trades against live regime signals (paper trading)

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Regime detection | `hmmlearn` | Used to develop 4-state Gaussian HMM |
| Explainability | `shap` | KernelExplainer on HMM posteriors |
| Changepoint detection | `ruptures` | PELT algorithm |
| Volatility | `arch` | GARCH(1,1) per regime |
| Macro data | `fredapi` | FRED API integration |
| Backend | FastAPI + Python 3.11 | 11 REST endpoints |
| Frontend | Next.js 14, TypeScript | UI |
| Charts | Recharts | All visualizations shown |
| Deployment | Vercel & Hugging Face Spaces | Deployment of Frontend & backend respectively |

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

## Screenshots
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/d3252f16-c103-4bfc-9725-c4148d6c6054" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/f31e262a-7d47-4fef-a064-de661758c925" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/c23dd7d6-f5ef-413a-94cf-4f5d23946694" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/e48bb5cd-458d-4fbd-abf9-bd8ab5242ae1" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/fbf24c8f-3cca-4ba6-bee3-41ef692dfb8e" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/43fe9a95-ee17-423d-9448-e7dc3e338943" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/b1eda770-1e1f-449d-916f-0429855a09de" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/820bb14c-82f8-4a79-a53d-4d6029d414dd" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/09b2000c-7dd3-4122-a1c0-f8baceca60c9" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/8f243908-b8b6-4392-ae8d-ad8f290f9d52" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/3d747cdd-b820-4ab7-80f2-3e332317037e" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/aebcf319-a746-4d1a-bd24-39b7156286f4" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/fb78900e-1c68-4a06-8d7b-239295c534de" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/c4c06929-4256-4715-a923-e962247662f0" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/91d1dcf0-a20b-4f0f-a8fb-f32b5d839a0e" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/fe94de3e-cbd3-4e96-ae5f-36ee9609e808" /></br>
<img width="806" height="453" alt="image" src="https://github.com/user-attachments/assets/391858d9-2fd3-4c1e-884f-c91c8f393f91" /></br>

---

