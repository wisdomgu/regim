"use client";

const FINDINGS = [
  {
    number: "01",
    title: "RL fails to exploit regime information",
    body: "PPO agents trained on the CTMSTOU simulation cannot reliably exploit market regime labels even when explicitly provided in their state space. Training converges to qualitatively different policies across random seeds, sometimes producing inverted regime sensitivity, executing more aggressively in bear markets than bull. Hard-coded regime conditioning bypasses the optimization problem that standard policy gradient methods cannot solve reliably.",
    metric: null,
  },
  {
    number: "02",
    title: "Crash regime requires completely different execution",
    body: "4-state HMM separates crash from bearish, a conflation the original paper's 2-state simulation couldn't expose. Crash vol is 1.3–2× higher than bearish vol, requiring halt-and-wait execution rather than patient limit orders. Treating them as a single 'bad' state loses the execution-critical distinction.",
    metric: "1.3–2× vol ratio",
  },
  {
    number: "03",
    title: "High-confidence signals outperform; transition zones do not",
    body: "~23% of trading days fall in low-confidence transition zones where regime-conditional execution shows no statistically significant edge over TWAP. Filtering to high-confidence signals lifts performance. Knowing when not to use the model is as important as building it, a finding that mirrors the RL paper's core insight about state uncertainty. Note: Short periods (3mo/6mo) during low-volatility markets may show 100% transitional classification, the model correctly identifies regime uncertainty rather than forcing a label.",
    metric: "23% transition days",
  },
  {
    number: "04",
    title: "Signal significance confirmed by permutation testing",
    body: "1000 permutations of shuffled regime labels produce an empirical null distribution. Observed cost savings sit above this null, confirming the regime signal carries real execution information rather than overfitting to historical data. Bonferroni correction applied across 3 simultaneous hypothesis tests.",
    metric: "1000 permutations",
  },
  {
    number: "05",
    title: "Regime-conditional GARCH reduces volatility forecast error",
    body: "Separate GARCH(1,1) fitted per regime state produces conditional 5-day volatility forecasts that outperform unconditional full-series GARCH on RMSE against 21-day rolling realised vol windows. Regimes contain forward-looking volatility information not captured by unconditional models.",
    metric: "RMSE reduction vs baseline",
  },
  {
    number: "06",
    title: "Bayesian changepoint detection leads HMM Viterbi by 1.5 days",
    body: "Ruptures PELT algorithm detects structural breaks in the return series. Compared against HMM Viterbi path smoothing, changepoints are identified a median of 1.5 days earlier, with 56.2% of regime transitions detected in advance. Earlier detection enables pre-emptive execution strategy adjustment before the HMM confirms a switch.",
    metric: "+1.5 days median lead",
  },
  {
    number: "07",
    title: "Macro fundamentals confirm statistical regimes",
    body: "FRED macroeconomic data (unemployment, Fed funds rate, CPI, yield curve, VIX, industrial production) mapped to HMM regime states via logistic regression and correlation analysis. VIX shows ρ=−0.745 with regime severity. Crash regimes average VIX 24.62 vs 10.32 in bullish, a 2.4× difference. Statistical regimes align with real economic fundamentals.",
    metric: "ρ = −0.745 (VIX)",
  },
  {
    number: "08",
    title: "BIC covariance selection is asset-dependent",
    body: "Model selection between full and diagonal covariance HMM via BIC produces different winners across asset classes. The optimal covariance structure for equities differs from crypto and bonds, a directly observable, citable finding that contradicts the assumption of a universal regime model structure.",
    metric: "asset-dependent BIC",
  },
];

const CITATIONS = [
  {
    label: "Primary paper",
    title: "Optimal Execution with Regime Switching",
    authors: "CTMSTOU framework",
    note: "RL failure finding directly motivated by this work",
  },
  {
    label: "Execution model",
    title: "Optimal Execution of Portfolio Transactions",
    authors: "Almgren & Chriss (2000)",
    note: "Market impact model extended with regime-dependent parameters",
  },
  {
    label: "Volatility",
    title: "ARCH/GARCH models for financial time series",
    authors: "Engle (1982), Bollerslev (1986)",
    note: "Regime-conditional extension: separate GARCH(1,1) per state",
  },
  {
    label: "Changepoint",
    title: "Optimal detection of changepoints with a linear computational cost",
    authors: "Killick, Fearnhead & Eckley (2012)",
    note: "PELT algorithm implemented via ruptures library",
  },
  {
    label: "Explainability",
    title: "A unified approach to interpreting model predictions",
    authors: "Lundberg & Lee (2017)",
    note: "SHAP KernelExplainer on HMM posterior probabilities",
  },
];

export default function Research() {
  return (
    <main>
      <div style={{ overflowY: "auto", height: "100vh" }}>
        <section>
          <nav>
            <div className="nav-col">
              <div className="nav-items">
                <p>Market Microstructure & Optimal Execution System</p>
              </div>
              <div className="nav-items">
                <a href="./">regim</a>
                <a href="about">about</a>
                <a href="contact">contact</a>
              </div>
            </div>
            <div className="nav-col">
              <div className="nav-items">
                <a href="dashboard">dashboard</a>
              </div>
              <div className="nav-items">
                <a href="https://github.com/wisdomgu/regim">github</a>
              </div>
              <div className="nav-items">
                <p>built by satish garg</p>
              </div>
            </div>
          </nav>
          <div className="research-header">
            <h1>findings</h1>
          </div>
        </section>

        <div className="research" style={{ padding: "1em"}}>

          <div style={{
            borderLeft: "2px solid #252525",
            paddingLeft: "1.5em",
            marginBottom: "4em",
            maxWidth: "60%",
            float: "right",
          }}>
            <p style={{ fontSize: "1.1em", lineHeight: 2, color: "#ebebeb", marginBottom: "1em" }}>
              Eight findings from building a regime-aware execution system that validates and extends
              the CTMSTOU reinforcement learning paper.
            </p>
            <p style={{ fontSize: ".75em", lineHeight: 2, color: "#DBD7D2" }}>
              All findings are reproducible from the live dashboard · Statistical tests include
              paired t-test, 1000-iteration permutation test, binomial test · Bonferroni corrected
            </p>
          </div>

          <div style={{ clear: "both", marginBottom: "2em" }} />

          <div style={{ borderTop: "1px solid #252525" }}>
            {FINDINGS.map((f) => (
              <div
                key={f.number}
                style={{
                  borderBottom: "1px solid #252525",
                  padding: "2em 0",
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto",
                  gap: "2em",
                  alignItems: "start",
                }}
              >
                <span style={{ fontSize: ".7em", color: "#DBD7D2", fontFamily: "monospace", paddingTop: ".2em" }}>
                  {f.number}
                </span>

                <div>
                  <p style={{ fontSize: ".9em", color: "#ebebeb", marginBottom: ".75em", lineHeight: 1.6 }}>
                    {f.title}
                  </p>
                  <p style={{ fontSize: ".75em", color: "#DBD7D2", lineHeight: 2 }}>
                    {f.body}
                  </p>
                </div>

                {f.metric && (
                  <div style={{
                    background: "#151515",
                    border: "1px solid #252525",
                    padding: ".5em .75em",
                    whiteSpace: "nowrap",
                    fontSize: ".8em",
                    color: "#DBD7D2",
                    fontFamily: "monospace",
                    alignSelf: "start",
                    marginTop: ".15em",
                  }}>
                    {f.metric}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "4em", borderTop: "1px solid #252525", paddingTop: "2em" }}>
            <p style={{ fontSize: ".7em", letterSpacing: ".08em", color: "#DBD7D2", marginBottom: "1.5em" }}>
              CITATIONS & EXTENSIONS
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>
              {CITATIONS.map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 1fr",
                    gap: "2em",
                    padding: ".75em 0",
                    borderBottom: "1px solid #1a1a1a",
                    alignItems: "start",
                  }}
                >
                  <span style={{ fontSize: ".65em", color: "#DBD7D2", fontFamily: "monospace" }}>
                    {c.label}
                  </span>
                  <div>
                    <p style={{ fontSize: ".75em", color: "#ebebeb", marginBottom: ".25em" }}>{c.title}</p>
                    <p style={{ fontSize: ".65em", color: "#DBD7D2" }}>{c.authors}</p>
                  </div>
                  <p style={{ fontSize: ".65em", color: "#DBD7D2", lineHeight: 1.8 }}>{c.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "4em", display: "flex", justifyContent: "flex-end" }}>
            <a
              href="dashboard"
              style={{
                fontSize: ".75em",
                color: "#ebebeb",
                border: "1px solid #252525",
                padding: ".75em 1.5em",
                background: "#151515",
                cursor: "pointer",
                display: "inline-block",
              }}
            >
              view live dashboard →
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}