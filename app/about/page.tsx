"use client";
import LandingAnimation from "@/components/LandingAnimation";
import { useEffect } from "react";
import gsap from "gsap";

export default function Home() {

  return (
    <main className="min-h-screen">
        <section>
          <nav>
            <div className="nav-col">
              <div className="nav-items">
                <p>Market Microstructure & Optimal Execution Research System</p>
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
                <a href="">github</a>
                <a href="findings">findings</a>
              </div>
              <div className="nav-items">
                <p>built by satish garg</p>
              </div>
            </div>
          </nav>

          <div className="about-header">
            <h1>about</h1>
          </div>
          
        </section>

        <div style={{
            borderLeft: "2px solid #252525",
            paddingLeft: "1.5em",
            marginBottom: "4em",
            maxWidth: "60%",
            float: "right",
          }}>
            <p style={{ fontSize: "1.1em", lineHeight: 2, color: "#ebebeb", marginBottom: "1em" }}>
              Regim: A Market Microstructure & Optimal Execution Research System
            </p>
            <p style={{ fontSize: ".75em", lineHeight: 2, color: "#DBD7D2" }}>
              A quantitative finance research platform that detects market regimes using machine learning and proves that hard-coded regime-aware execution outperforms standard baselines, validating a key finding from reinforcement learning research.
            </p>
        </div>

        <div className="about-para">
          <p>
            I wrote a research paper establishing that RL agents cannot reliably exploit market regime
            information for optimal trade execution, even when the regime label is explicitly in their
            state space. The failure is structural: PPO training converges to qualitatively different
            policies depending on random initialization, sometimes producing inverted regime sensitivity,
            executing more aggressively in bear markets than bull markets, directly contrary to domain knowledge.<br /><br />
 
            The paper concludes that hard-coded regime conditioning bypasses an optimization problem
            that standard policy gradient methods cannot solve reliably. This system is that conclusion made operational.<br /><br />
 
            A 4-state Gaussian HMM detects crash, bearish, transitional, and bullish regimes across
            8 assets in real time. The crash state identification, selecting the highest-volatility
            state among the two lowest-return states, resolves a conflation the paper's two-state
            simulation couldn't expose: crash vol is 1.3–2× higher than bearish, with completely
            different execution implications (halt vs patient limits).<br /><br />
 
            Walk-forward out-of-sample validation with three simultaneous statistical tests
            (paired t-test, permutation test with 1000 shuffles, binomial test) and Bonferroni
            correction establishes where regime-aware execution actually works. High-confidence
            signals outperform; low-confidence transition zones (~23% of trading days) show no
            significant edge. Knowing when not to use the model matters as much as building it.<br /><br />
 
            Three research extensions go beyond the original paper: regime-conditional GARCH(1,1)
            reduces 5-day volatility forecast RMSE vs unconditional models; Bayesian changepoint
            detection (PELT) identifies regime switches a median of 1.5 days earlier than HMM
            Viterbi smoothing; FRED macroeconomic attribution maps statistical regimes to real
            fundamentals, finding VIX correlation ρ=−0.745 with crash regimes averaging 2.4×
            higher VIX than bullish regimes.<br /><br />
 
            The Paper vs Reality tab places CTMSTOU simulation parameters directly against
            empirically learned HMM transition rates. The Statistics tab surfaces every
            p-value, confidence interval, and permutation result in one place.
          </p><br />
          <p>Website design inspired by Zajno Digital Studio</p>
        </div>
    </main>
  );
}