"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  AtSign,
  ArrowRight,
  Check,
  ShoppingCart,
  Boxes,
  Truck,
  Calculator,
  Pill,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useBrand } from "@/components/theme/ThemeProvider";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------- data ---- */

const COUNTRY_CODES = [
  { value: "+91", label: "🇮🇳 +91" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+65", label: "🇸🇬 +65" },
  { value: "+61", label: "🇦🇺 +61" },
];

const BUSINESS_TYPES = [
  { value: "grocery", label: "Grocery & Supermarket" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "textile", label: "Textile & Garments" },
  { value: "electronics", label: "Electronics & Mobile" },
  { value: "hardware", label: "Hardware" },
  { value: "furniture", label: "Furniture" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "wholesale", label: "Wholesale Distribution" },
  { value: "other", label: "Other" },
];

const FEATURES = [
  { icon: ShoppingCart, label: "POS Billing" },
  { icon: Boxes, label: "Inventory Management" },
  { icon: Truck, label: "Purchase Management" },
  { icon: Calculator, label: "Accounting & GST" },
  { icon: Pill, label: "Pharmacy Management" },
  { icon: BarChart3, label: "Reports & Analytics" },
];

// Simulated "already registered" records to demo duplicate validation.
const TAKEN_EMAILS = ["admin@onepos.cloud", "test@onepos.cloud"];
const TAKEN_MOBILES = ["9999999999", "1234567890"];

/* ---------------------------------------------------------- validation ---- */

interface FormState {
  fullName: string;
  countryCode: string;
  mobile: string;
  email: string;
  username: string;
  password: string;
  confirm: string;
  businessName: string;
  businessType: string;
  agree: boolean;
}

type Errors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordRules(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

function passwordScore(pw: string) {
  const r = passwordRules(pw);
  return Object.values(r).filter(Boolean).length; // 0..4
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.fullName.trim()) e.fullName = "Full name is required.";
  else if (f.fullName.trim().length < 2) e.fullName = "Enter your full name.";

  if (!f.mobile.trim()) e.mobile = "Mobile number is required.";
  else if (!/^\d{7,12}$/.test(f.mobile.trim()))
    e.mobile = "Enter a valid mobile number.";
  else if (TAKEN_MOBILES.includes(f.mobile.trim()))
    e.mobile = "This mobile number is already registered.";

  if (!f.email.trim()) e.email = "Email address is required.";
  else if (!EMAIL_RE.test(f.email.trim()))
    e.email = "Enter a valid email address.";
  else if (TAKEN_EMAILS.includes(f.email.trim().toLowerCase()))
    e.email = "An account with this email already exists.";

  if (!f.username.trim()) e.username = "Username is required.";
  else if (f.username.trim().length < 3)
    e.username = "Username must be at least 3 characters.";
  else if (/\s/.test(f.username))
    e.username = "Username cannot contain spaces.";

  if (!f.password) e.password = "Password is required.";
  else if (passwordScore(f.password) < 4)
    e.password = "Password does not meet all requirements.";

  if (!f.confirm) e.confirm = "Please confirm your password.";
  else if (f.confirm !== f.password) e.confirm = "Passwords do not match.";

  if (!f.businessName.trim()) e.businessName = "Business name is required.";
  if (!f.businessType) e.businessType = "Please select a business type.";
  if (!f.agree) e.agree = "You must accept the Terms to continue.";

  return e;
}

/* -------------------------------------------------------------- screen ---- */

const STRENGTH = [
  { label: "Too weak", color: "var(--color-danger)" },
  { label: "Weak", color: "var(--color-danger)" },
  { label: "Fair", color: "var(--color-warning)" },
  { label: "Good", color: "var(--color-secondary)" },
  { label: "Strong", color: "var(--color-success)" },
];

export default function RegisterPage() {
  const router = useRouter();
  const brand = useBrand();
  const [form, setForm] = useState<FormState>({
    fullName: "",
    countryCode: "+91",
    mobile: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
    businessName: "",
    businessType: "",
    agree: false,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>(
    {}
  );
  const [submitted, setSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Field-level errors returned by the API (e.g. duplicate email / mobile).
  const [serverErrors, setServerErrors] = useState<Errors>({});
  // Form-level message (network / server failure).
  const [formError, setFormError] = useState<string>("");

  const errors = useMemo(() => validate(form), [form]);
  const rules = passwordRules(form.password);
  const score = passwordScore(form.password);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Editing a field clears the server error it had (e.g. "email already exists").
    if (serverErrors[key]) setServerErrors((s) => ({ ...s, [key]: undefined }));
    if (formError) setFormError("");
  }
  function blur(key: keyof FormState) {
    setTouched((t) => ({ ...t, [key]: true }));
  }
  // Show client errors after the field was touched/submitted; server errors always.
  function err(key: keyof FormState) {
    return serverErrors[key] ?? (touched[key] || submitted ? errors[key] : undefined);
  }

  function focusFirstInvalid() {
    const first = document.querySelector<HTMLElement>("[data-invalid='true']");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError("");
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          countryCode: form.countryCode,
          mobile: form.mobile,
          email: form.email,
          username: form.username,
          password: form.password,
          confirm: form.confirm,
          businessName: form.businessName,
          businessType: form.businessType,
          agree: form.agree,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Map server field errors back onto the form (422 validation / 409 duplicate).
        if (json?.errors && typeof json.errors === "object") {
          setServerErrors(json.errors as Errors);
          // wait a tick so the error nodes render, then focus the first one
          setTimeout(focusFirstInvalid, 0);
        }
        setFormError(json?.message || "Registration failed. Please try again.");
        return;
      }

      // Success — account is active immediately; head to sign in (no OTP step).
      setSuccess(true);
      setTimeout(() => router.push(json?.redirect || "/login"), 1900);
    } catch {
      setFormError("Network error — could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ============================ LEFT 40% ============================ */}
      <aside className="relative hidden w-2/5 flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
        {/* Brand gradient background */}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <div className="absolute inset-0 bg-menu/30" />
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative">
          <Logo invert />
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Retail ERP &amp; POS
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight xl:text-[2.1rem]">
            One platform to run your entire retail business.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Manage Sales, Inventory, Accounting, GST, Pharmacy, CRM and
            Multi-Store operations — from a single counter to a national chain.
          </p>

          {/* Feature highlights */}
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur-sm"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/15">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium leading-tight">
                  {f.label}
                </span>
              </li>
            ))}
          </ul>

          {/* Illustration: mini retail/POS/analytics scene */}
          <div className="mt-8 overflow-hidden rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wide text-white/70">
                Live Store Dashboard
              </span>
              <Store className="h-4 w-4 text-white/70" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Sales", "₹2.4L"],
                ["Orders", "318"],
                ["Stock", "12.7K"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/10 p-2">
                  <div className="text-2xs text-white/60">{k}</div>
                  <div className="text-sm font-bold">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex h-16 items-end gap-1.5">
              {[40, 62, 48, 75, 58, 88, 70, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-white/40"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" />
          Bank-grade security · GST-ready · Cloud or On-Premise
        </div>
      </aside>

      {/* ============================ RIGHT 60% ============================ */}
      <main className="flex w-full flex-col lg:w-3/5">
        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8 sm:px-6 md:py-10">
          <div className="w-full max-w-xl">
            {/* Mobile logo */}
            <div className="mb-6 lg:hidden">
              <Logo />
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-md sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Create Your Account
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Start your free trial and set up your business in minutes.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-7">
                {/* ---------- Section 1: Personal ---------- */}
                <FormSection step={1} title="Personal Information">
                  <Input
                    name="fullName"
                    label="Full Name *"
                    placeholder="e.g. Arjun Rao"
                    leadingIcon={<User className="h-4 w-4" />}
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    onBlur={() => blur("fullName")}
                    error={err("fullName")}
                    data-invalid={!!err("fullName")}
                    autoComplete="name"
                  />

                  {/* Mobile with country code */}
                  <div>
                    <label
                      htmlFor="mobile"
                      className="mb-1.5 block text-xs font-medium text-muted"
                    >
                      Mobile Number *
                    </label>
                    <div
                      className={cn(
                        "flex overflow-hidden rounded-md border bg-surface transition focus-within:border-primary focus-within:shadow-focus",
                        err("mobile") ? "border-danger" : "border-border-strong"
                      )}
                    >
                      <select
                        aria-label="Country code"
                        value={form.countryCode}
                        onChange={(e) => set("countryCode", e.target.value)}
                        className="h-10 shrink-0 border-r border-border bg-surface-2 pl-3 pr-2 text-sm text-foreground focus:outline-none"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        inputMode="numeric"
                        placeholder="98765 43210"
                        value={form.mobile}
                        onChange={(e) =>
                          set("mobile", e.target.value.replace(/[^\d]/g, ""))
                        }
                        onBlur={() => blur("mobile")}
                        data-invalid={!!err("mobile")}
                        className="h-10 w-full bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:outline-none"
                        autoComplete="tel"
                      />
                    </div>
                    {err("mobile") && (
                      <p className="mt-1 text-xs text-danger">{err("mobile")}</p>
                    )}
                  </div>

                  <Input
                    name="email"
                    type="email"
                    label="Email Address *"
                    placeholder="you@company.com"
                    leadingIcon={<Mail className="h-4 w-4" />}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => blur("email")}
                    error={err("email")}
                    data-invalid={!!err("email")}
                    autoComplete="email"
                  />
                </FormSection>

                {/* ---------- Section 2: Account ---------- */}
                <FormSection step={2} title="Account Information">
                  <Input
                    name="username"
                    label="Username *"
                    placeholder="Choose a username"
                    leadingIcon={<AtSign className="h-4 w-4" />}
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    onBlur={() => blur("username")}
                    error={err("username")}
                    data-invalid={!!err("username")}
                    autoComplete="username"
                  />

                  <Input
                    name="password"
                    type={showPw ? "text" : "password"}
                    label="Password *"
                    placeholder="Create a strong password"
                    leadingIcon={<Lock className="h-4 w-4" />}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    onBlur={() => blur("password")}
                    error={err("password")}
                    data-invalid={!!err("password")}
                    autoComplete="new-password"
                    trailingIcon={
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="pointer-events-auto text-subtle transition hover:text-foreground"
                      >
                        {showPw ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                  />

                  {/* Strength meter + rules */}
                  {form.password && (
                    <div className="-mt-1 space-y-2 rounded-lg bg-surface-2 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-1.5 flex-1 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="flex-1 rounded-full transition-all"
                              style={{
                                backgroundColor:
                                  i < score
                                    ? STRENGTH[score].color
                                    : "var(--color-border-strong)",
                              }}
                            />
                          ))}
                        </div>
                        <span
                          className="text-2xs font-semibold"
                          style={{ color: STRENGTH[score].color }}
                        >
                          {STRENGTH[score].label}
                        </span>
                      </div>
                      <ul className="grid grid-cols-2 gap-1.5">
                        {[
                          ["Min 8 characters", rules.length],
                          ["One uppercase letter", rules.upper],
                          ["One number", rules.number],
                          ["One special character", rules.special],
                        ].map(([label, ok]) => (
                          <li
                            key={label as string}
                            className={cn(
                              "flex items-center gap-1.5 text-2xs",
                              ok ? "text-success" : "text-subtle"
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full",
                                ok ? "bg-success text-white" : "bg-border-strong"
                              )}
                            >
                              {ok && <Check className="h-2.5 w-2.5" />}
                            </span>
                            {label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Input
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    label="Confirm Password *"
                    placeholder="Re-enter your password"
                    leadingIcon={<Lock className="h-4 w-4" />}
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                    onBlur={() => blur("confirm")}
                    error={err("confirm")}
                    data-invalid={!!err("confirm")}
                    autoComplete="new-password"
                    trailingIcon={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((s) => !s)}
                        aria-label={
                          showConfirm ? "Hide password" : "Show password"
                        }
                        className="pointer-events-auto text-subtle transition hover:text-foreground"
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                  />
                </FormSection>

                {/* ---------- Section 3: Business ---------- */}
                <FormSection step={3} title="Business Information">
                  <Input
                    name="businessName"
                    label="Business Name *"
                    placeholder="e.g. Rao Super Market"
                    leadingIcon={<Store className="h-4 w-4" />}
                    value={form.businessName}
                    onChange={(e) => set("businessName", e.target.value)}
                    onBlur={() => blur("businessName")}
                    error={err("businessName")}
                    data-invalid={!!err("businessName")}
                  />
                  <Select
                    name="businessType"
                    label="Business Type *"
                    placeholder="Select your business type"
                    options={BUSINESS_TYPES}
                    value={form.businessType}
                    onChange={(e) => set("businessType", e.target.value)}
                    onBlur={() => blur("businessType")}
                    error={err("businessType")}
                    data-invalid={!!err("businessType")}
                  />
                </FormSection>

                {/* ---------- Terms ---------- */}
                <div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={form.agree}
                      onChange={(e) => set("agree", e.target.checked)}
                      onBlur={() => blur("agree")}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[var(--color-primary)]"
                    />
                    <span>
                      I agree to the{" "}
                      <a
                        href="#"
                        className="font-medium text-primary hover:underline"
                      >
                        Terms &amp; Conditions
                      </a>{" "}
                      and{" "}
                      <a
                        href="#"
                        className="font-medium text-primary hover:underline"
                      >
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  {err("agree") && (
                    <p className="mt-1 text-xs text-danger">{err("agree")}</p>
                  )}
                </div>

                {/* ---------- Form-level error ---------- */}
                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* ---------- Actions ---------- */}
                <Button type="submit" size="lg" block disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account…
                    </>
                  ) : (
                    <>
                      Create Free Account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-primary hover:underline"
                  >
                    Login Now
                  </Link>
                </p>

                {/* ---------- Social ---------- */}
                <div className="flex items-center gap-3 text-2xs uppercase tracking-wide text-subtle">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" type="button">
                    <GoogleIcon />
                    Continue with Google
                  </Button>
                  <Button variant="outline" size="lg" type="button">
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </Button>
                </div>
              </form>
            </div>

            <p className="mt-6 text-center text-2xs text-subtle">
              © 2026 {brand.productName || DEFAULT_PRODUCT_NAME} · Enterprise Retail ERP + POS
            </p>
          </div>
        </div>
      </main>

      {/* ===================== SUCCESS OVERLAY ===================== */}
      {success && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="success-pop mx-4 w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-xl">
            <div className="relative mx-auto grid h-20 w-20 place-items-center">
              <span className="success-ring absolute inset-0 rounded-full bg-success/30" />
              <span className="relative grid h-20 w-20 place-items-center rounded-full bg-success">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none">
                  <path
                    className="check-path"
                    d="M5 13l4 4L19 7"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">
              Registration Successful
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Your account is ready. Redirecting to sign in…
            </p>
            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" />
              You can now log in to your account
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- helpers ---- */

function FormSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-subtle text-2xs font-bold text-primary">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}
