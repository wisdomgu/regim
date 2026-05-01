"use client";
import LandingAnimation from "@/components/LandingAnimation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/trackEvent";
import gsap from "gsap";

export default function Home() {
  
  useEffect(() => {
    trackEvent({ tab: "landing" });
  }, []);


  return (
    <main>
      <LandingAnimation></LandingAnimation>

      <div className="container">
        <div className="counter"><p>0</p></div>

        <section className="hero">
          <div className="overlay"></div>

          <nav>
            <div className="nav-col">
              <div className="nav-items">
                <p>Market Microstructure & Optimal Execution System</p>
                </div>
              <div className="nav-items">
                <a href="">regim</a>
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
                <a href="findings">findings</a>
              </div>
              <div className="nav-items">
                <p>built by satish garg</p>
              </div>
            </div>
          </nav>

          <div className="header">
            <h1>regim</h1>
          </div>

          <div className="hero-img">
            <img src="hero.jpg" alt="" />
          </div>

        </section>
      </div>
    </main>
  );
}
