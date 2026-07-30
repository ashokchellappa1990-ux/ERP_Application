"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Smartphone, Mail } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyOtpPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const code = digits.join("");

  function setDigit(index: number, value: string) {
    const v = value.replace(/[^0-9]/g, "");
    if (!v) {
      setDigits((d) => d.map((x, i) => (i === index ? "" : x)));
      return;
    }
    setError("");
    setDigits((d) => {
      const next = [...d];
      // allow pasting multiple from a single field
      v.split("").forEach((ch, k) => {
        if (index + k < OTP_LENGTH) next[index + k] = ch;
      });
      return next;
    });
    const nextIndex = Math.min(index + v.length, OTP_LENGTH - 1);
    inputs.current[nextIndex]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1)
      inputs.current[index + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    if (!text) return;
    setError("");
    setDigits(
      Array.from({ length: OTP_LENGTH }, (_, i) => text[i] ?? "")
    );
    inputs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleVerify() {
    if (code.length < OTP_LENGTH) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setVerifying(true);
    // Demo: any complete code succeeds → start business setup onboarding.
    setTimeout(() => router.push("/setup"), 900);
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow-md sm:p-8">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary-subtle">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>

          <h1 className="text-center text-xl font-bold tracking-tight text-foreground">
            Verify your account
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-center text-sm text-muted">
            We sent a 6-digit verification code to your registered mobile and
            email. Enter it below to continue.
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 text-2xs text-subtle">
            <span className="inline-flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" /> +91 ••••• •3210
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> a•••@onepos.cloud
            </span>
          </div>

          {/* OTP inputs */}
          <div className="mt-6 flex justify-center gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={onPaste}
                className={cn(
                  "h-12 w-11 rounded-lg border bg-surface text-center text-lg font-bold text-foreground transition sm:h-14 sm:w-12",
                  "focus:border-primary focus:outline-none focus:shadow-focus",
                  error ? "border-danger" : "border-border-strong"
                )}
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 text-center text-xs text-danger">{error}</p>
          )}

          <Button
            size="lg"
            block
            className="mt-6"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? "Verifying…" : "Verify & Continue"}
            {!verifying && <ArrowRight className="h-4 w-4" />}
          </Button>

          <div className="mt-5 text-center text-sm text-muted">
            Didn&apos;t receive the code?{" "}
            {secondsLeft > 0 ? (
              <span className="text-subtle">
                Resend in 0:{secondsLeft.toString().padStart(2, "0")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSecondsLeft(RESEND_SECONDS)}
                className="font-semibold text-primary hover:underline"
              >
                Resend code
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Entered the wrong details?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary hover:underline"
          >
            Back to registration
          </Link>
        </p>
      </div>
    </div>
  );
}
