import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { name, email, message, honeypot } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (name.length > 100 || email.length > 200 || message.length > 2000) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const key = `contact:${ip}`;
  if (rateLimitHit(key)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "satish.brainiac@gmail.com",
      subject: `regim - message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}

const attempts = new Map<string, { count: number; reset: number }>();

function rateLimitHit(key: string, max = 3, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now > record.reset) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (record.count >= max) return true;
  record.count++;
  return false;
}