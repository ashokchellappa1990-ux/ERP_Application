import { NextResponse } from "next/server";
import { createLead } from "@/lib/website/service";

/** Public — capture a Start-Trial / Book-Demo / Contact lead from the website. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!name || name.length < 2) return NextResponse.json({ ok: false, message: "Please enter your name." }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, message: "Please enter a valid email." }, { status: 422 });

  try {
    const id = await createLead({
      type: String(body.type ?? "contact"), name, email,
      phone: body.phone ? String(body.phone) : undefined, company: body.company ? String(body.company) : undefined,
      industry: body.industry ? String(body.industry) : undefined, plan: body.plan ? String(body.plan) : undefined,
      message: body.message ? String(body.message) : undefined, source: body.source ? String(body.source) : "website",
    });
    const type = String(body.type ?? "contact");
    const msg = type === "trial" ? "Thanks! Your free trial request is in — we'll email your login shortly."
      : type === "demo" ? "Thanks! Our team will reach out to schedule your demo."
      : "Thanks for reaching out — we'll get back to you soon.";
    return NextResponse.json({ ok: true, id, message: msg }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
