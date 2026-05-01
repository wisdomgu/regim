"use client";
import { useState } from "react";

export default function Contact() {
  const [form, setForm]     = useState({ name: "", email: "", message: "", honeypot: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState({ name: "", email: "", message: "" });

  const validate = () => {
    const e = { name: "", email: "", message: "" };
    if (!form.name.trim())                        e.name    = "required";
    if (!form.email.trim())                       e.email   = "required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "invalid email";
    if (!form.message.trim())                     e.message = "required";
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  const handleSubmit = async () => {
    const valid = validate();
    if (!valid) return;
    setStatus("sending");

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setStatus(res.ok ? "sent" : "error");
  };

  return (
    <main className="min-h-screen">
      <section className="dash-header">
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
              <a href="">github</a>
              <a href="findings">findings</a>
            </div>
            <div className="nav-items">
              <p>built by satish garg</p>
            </div>
          </div>
        </nav>
        <div className="sub-header">
          <h1>contact</h1>
        </div>
      </section>

      <div className="contact-wrap">
          <div className="contact-intro">
          <p>open to feedback</p>
          <span>on the research, the system, or anything else. always happy to hear from other people working on similar problems</span>
        </div>
        {status === "sent" ? (
          <div className="contact-success">
            <p>message recieved</p>
            <span>i'll get back to you soon</span>
          </div>
        ) : (
          <div className="contact-form">
            <div style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.honeypot}
                onChange={e => setForm({ ...form, honeypot: e.target.value })}
              />
            </div>
            <div className="contact-field">
              <label>name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="your name"
              />
            {errors.name && <span className="contact-field-error">{errors.name}</span>}
            </div>
            <div className="contact-field">
              <label>email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="yourname@email.com"
              />
            {errors.email && <span className="contact-field-error">{errors.email}</span>}
            </div>
            <div className="contact-field">
              <label>message</label>
              <textarea
                rows={6}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="whats on your mind?"
              />
            {errors.message && <span className="contact-field-error">{errors.message}</span>}
            </div>
            {status === "error" && (
              <p className="contact-error">something went wrong. try again.</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={status === "sending"}
              className="contact-submit"
            >
              {status === "sending" ? "sending..." : "send message"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}