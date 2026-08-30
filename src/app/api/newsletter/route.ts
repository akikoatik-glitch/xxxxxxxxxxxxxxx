import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getPrisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email?.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const prisma = getPrisma();

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: process.env.MAIL_FROM || "XWhiz Lite <onboarding@resend.dev>",
        to: email,
        subject: "Welcome to XWhiz Lite — free weekly value picks",
        html: "<h2>Welcome to XWhiz Lite</h2><p>You are on the list. Every week you get a round-up of our highest-confidence football predictions before the weekend slate.</p><p>Remember: predictions are statistical estimates, not guarantees. Play responsibly — 18+.</p>"
      });
      return NextResponse.json({ ok: true, mode: "resend" });
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  if (prisma) {
    try {
      await prisma.newsletterSubscriber.upsert({
        where: { email },
        update: {},
        create: { email }
      });
      return NextResponse.json({ ok: true, mode: "database" });
    } catch (err) {
      console.error("Newsletter db error:", err);
      return NextResponse.json({ error: "storage_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, mode: "demo" });
}
