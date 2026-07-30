"use client";

/**
 * Website CMS — lets the Product Owner manage the entire public marketing site
 * from the platform portal without touching code: identity/colours, the homepage
 * builder (enable/disable + reorder + draft/publish), hero, menus, pricing,
 * testimonials, SEO, footer/contact/social, and captured leads.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown, Eye, EyeOff, Save, Rocket, RotateCcw, ExternalLink, Plus, Trash2, Globe, Upload, Image as ImageIcon, Copy, Check } from "lucide-react";
import { SECTION_LABELS, THEME_PRESETS, type WebsiteConfig, type PricingPlan, type Testimonial, type NavItem, type ClientLogo, type Spotlight, type QuickModule, type IndustryItem, type SectionBackground } from "@/lib/website/config";

const BG_SECTIONS = ["hero", "everything", "realtime", "aiMarketing", "customerApp", "industries", "stats", "integrationLogos", "cta", "erpIndustries", "pricing", "blog"];
const OVERLAY_OPTIONS: [string, string][] = [
  ["none", "None"], ["light", "Light"], ["light-strong", "Light (strong)"], ["dark", "Dark"], ["dark-strong", "Dark (strong)"],
  ["brand", "Brand tint"], ["brand-strong", "Brand (strong)"], ["gradient-brand-full", "Gradient · Brand"],
  ["gradient-dark-b", "Gradient · Dark (bottom)"], ["gradient-dark-t", "Gradient · Dark (top)"], ["gradient-dark-l", "Gradient · Dark (left)"], ["gradient-dark-r", "Gradient · Dark (right)"],
  ["gradient-brand-b", "Gradient · Brand (bottom)"], ["gradient-brand-l", "Gradient · Brand (left)"], ["vignette", "Vignette"],
];

const inp = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-slate-500";
const btn = "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50";
const btnO = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-2xs font-semibold text-slate-700 transition hover:border-indigo-400";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";

const TABS = ["Theme & Identity", "Banner", "Modules", "Industries", "Section Images", "Backgrounds", "Homepage Builder", "Menus", "Clients", "Spotlights", "Pricing", "Testimonials", "SEO", "Footer", "Media", "Leads"] as const;
type Tab = typeof TABS[number];

export function WebsiteCms({ flash }: { flash: (m: string) => void }) {
  const [cfg, setCfg] = useState<WebsiteConfig | null>(null);
  const [tab, setTab] = useState<Tab>("Homepage Builder");
  const [busy, setBusy] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/platform/website", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setCfg(j.config); setPublishedAt(j.publishedAt); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (action: "draft" | "publish" | "reset") => {
    if (!cfg) return;
    setBusy(true);
    const j = await fetch("/api/platform/website", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: action === "draft" ? undefined : action, config: cfg }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (j.ok) { flash(j.message || "Saved."); if (j.config) setCfg(j.config); if (j.publishedAt) setPublishedAt(j.publishedAt); }
    else flash(j.message || "Save failed.");
  };

  const patch = (fn: (c: WebsiteConfig) => void) => setCfg((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });

  if (!cfg) return <div className="py-16 text-center text-sm text-slate-400">Loading website…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Globe className="h-5 w-5 text-indigo-600" /> Website CMS</h1>
          <p className="text-2xs text-slate-500">Manage the public marketing site — no code. {publishedAt ? `Last published ${new Date(publishedAt).toLocaleString()}` : "Not published yet."}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noreferrer" className={btnO}><ExternalLink className="h-3.5 w-3.5" /> Preview site</a>
          <button onClick={() => save("reset")} disabled={busy} className={btnO}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <button onClick={() => save("draft")} disabled={busy} className={btnO}><Save className="h-3.5 w-3.5" /> Save Draft</button>
          <button onClick={() => save("publish")} disabled={busy} className={btn}><Rocket className="h-4 w-4" /> Publish</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-2xs font-semibold transition", tab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100")}>{t}</button>)}
      </div>

      {tab === "Theme & Identity" && (
        <div className="space-y-4">
        <div className={cn(card, "p-5")}>
          <label className={lbl}>Colour Theme — one click to restyle the whole site</label>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((t) => {
              const active = cfg.identity.primaryColor.toLowerCase() === t.primary.toLowerCase();
              return (
                <button key={t.id} onClick={() => patch((c) => { c.identity.primaryColor = t.primary; c.identity.secondaryColor = t.secondary; c.identity.accentColor = t.accent; })} className={cn("flex items-center gap-2 rounded-xl border p-2 pr-3 transition", active ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 hover:border-indigo-300")}>
                  <span className="flex overflow-hidden rounded-lg"><span className="h-7 w-4" style={{ background: t.primary }} /><span className="h-7 w-4" style={{ background: t.secondary }} /><span className="h-7 w-4" style={{ background: t.accent }} /></span>
                  <span className="text-2xs font-semibold text-slate-700">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <Field label="Product Name"><input className={inp} value={cfg.identity.productName} onChange={(e) => patch((c) => { c.identity.productName = e.target.value; })} /></Field>
          <Field label="Logo Text"><input className={inp} value={cfg.identity.logoText} onChange={(e) => patch((c) => { c.identity.logoText = e.target.value; })} /></Field>
          <Field label="Tagline"><input className={inp} value={cfg.identity.tagline} onChange={(e) => patch((c) => { c.identity.tagline = e.target.value; })} /></Field>
          <Field label="Font"><input className={inp} value={cfg.identity.font} onChange={(e) => patch((c) => { c.identity.font = e.target.value; })} /></Field>
          <ImageField label="Logo (optional) — URL or upload" value={cfg.identity.logoUrl ?? ""} onChange={(v) => patch((c) => { c.identity.logoUrl = v; })} />
          <ImageField label="Favicon (optional) — URL or upload" value={cfg.identity.faviconUrl ?? ""} onChange={(v) => patch((c) => { c.identity.faviconUrl = v; })} />
          <ColorField label="Primary Color" value={cfg.identity.primaryColor} onChange={(v) => patch((c) => { c.identity.primaryColor = v; })} />
          <ColorField label="Secondary Color" value={cfg.identity.secondaryColor} onChange={(v) => patch((c) => { c.identity.secondaryColor = v; })} />
          <ColorField label="Accent Color" value={cfg.identity.accentColor} onChange={(v) => patch((c) => { c.identity.accentColor = v; })} />
        </div>

        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Login Screen Content</h3>
          <p className="text-2xs text-slate-400 sm:col-span-2">Everything shown on the sign-in screen's left panel — headline, subtitle, module cards and the trust strip. Publish to apply.</p>
          <Field label="Headline — Line 1"><input className={inp} value={cfg.identity.loginHeadlineLine1 ?? ""} onChange={(e) => patch((c) => { c.identity.loginHeadlineLine1 = e.target.value; })} /></Field>
          <div />
          <Field label="Headline — Line 2 (before highlight)"><input className={inp} value={cfg.identity.loginHeadlineLine2Before ?? ""} onChange={(e) => patch((c) => { c.identity.loginHeadlineLine2Before = e.target.value; })} /></Field>
          <Field label="Headline — Highlighted word"><input className={inp} value={cfg.identity.loginHeadlineHighlight ?? ""} onChange={(e) => patch((c) => { c.identity.loginHeadlineHighlight = e.target.value; })} /></Field>
          <Field label="Headline — Line 2 (after highlight)" full><input className={inp} value={cfg.identity.loginHeadlineLine2After ?? ""} onChange={(e) => patch((c) => { c.identity.loginHeadlineLine2After = e.target.value; })} /></Field>
          <Field label="Subtitle" full><textarea rows={2} className={cn(inp, "h-auto py-2")} value={cfg.identity.loginSubtitle ?? ""} onChange={(e) => patch((c) => { c.identity.loginSubtitle = e.target.value; })} /></Field>
          <label className="flex items-center gap-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={cfg.identity.loginShowModules ?? true} onChange={(e) => patch((c) => { c.identity.loginShowModules = e.target.checked; })} /> Show module cards grid</label>
          <label className="flex items-center gap-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={cfg.identity.loginShowCodeSnippet ?? true} onChange={(e) => patch((c) => { c.identity.loginShowCodeSnippet = e.target.checked; })} /> Show decorative code snippet</label>
          <label className="flex items-center gap-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={cfg.identity.loginShowTrust ?? true} onChange={(e) => patch((c) => { c.identity.loginShowTrust = e.target.checked; })} /> Show "Why choose us" trust strip</label>
          <Field label="Trust strip title"><input className={inp} value={cfg.identity.loginTrustTitle ?? ""} onChange={(e) => patch((c) => { c.identity.loginTrustTitle = e.target.value; })} /></Field>
          <label className="flex items-center gap-2 text-2xs font-semibold text-slate-600 sm:col-span-2"><input type="checkbox" checked={cfg.identity.loginShowNews ?? true} onChange={(e) => patch((c) => { c.identity.loginShowNews = e.target.checked; })} /> Show animated "News &amp; Updates" ticker (between the header and the image)</label>
          <label className="flex items-center gap-2 text-2xs font-semibold text-slate-600 sm:col-span-2"><input type="checkbox" checked={cfg.identity.loginShowCapabilities ?? true} onChange={(e) => patch((c) => { c.identity.loginShowCapabilities = e.target.checked; })} /> Show capability strip (pill bar right below the module cards)</label>
        </div>

        <Repeater title="Login — News & Updates (auto-rotating ticker)" items={cfg.identity.loginNewsItems ?? []}
          onAdd={() => patch((c) => { (c.identity.loginNewsItems ??= []).push({ tag: "New", title: "New update", text: "", date: "", icon: "Sparkles" }); })}
          onRemove={(i) => patch((c) => { c.identity.loginNewsItems?.splice(i, 1); })}
          render={(nItem: { tag?: string; title: string; text: string; date?: string; icon: string }, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Title" value={nItem.title} onChange={(e) => patch((c) => { c.identity.loginNewsItems![i].title = e.target.value; })} />
              <input className={inp} placeholder="Tag (e.g. New, Update)" value={nItem.tag ?? ""} onChange={(e) => patch((c) => { c.identity.loginNewsItems![i].tag = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. Sparkles, FileCheck)" value={nItem.icon} onChange={(e) => patch((c) => { c.identity.loginNewsItems![i].icon = e.target.value; })} />
              <input className={inp} placeholder="Date label (e.g. Jul 2026)" value={nItem.date ?? ""} onChange={(e) => patch((c) => { c.identity.loginNewsItems![i].date = e.target.value; })} />
              <div className="sm:col-span-2"><textarea rows={2} className={cn(inp, "h-auto py-2")} placeholder="Short description" value={nItem.text} onChange={(e) => patch((c) => { c.identity.loginNewsItems![i].text = e.target.value; })} /></div>
            </div>
          )} />

        <Repeater title="Login — Capability Strip (pill bar below the module cards)" items={cfg.identity.loginCapabilityItems ?? []}
          onAdd={() => patch((c) => { (c.identity.loginCapabilityItems ??= []).push({ icon: "Sparkles", label: "New capability" }); })}
          onRemove={(i) => patch((c) => { c.identity.loginCapabilityItems?.splice(i, 1); })}
          render={(cap: { icon: string; label: string }, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Label" value={cap.label} onChange={(e) => patch((c) => { c.identity.loginCapabilityItems![i].label = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. Building2, ShieldCheck)" value={cap.icon} onChange={(e) => patch((c) => { c.identity.loginCapabilityItems![i].icon = e.target.value; })} />
            </div>
          )} />

        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Module &amp; Trust Card Style</h3>
          <p className="text-2xs text-slate-400 sm:col-span-2">How each module card and each footer trust card presents its icon — shape, position and background strength. Colour always follows the brand Primary/Secondary colours above.</p>
          <Field label="Module card — icon shape">
            <select className={inp} value={cfg.identity.loginModuleIconShape ?? "square"} onChange={(e) => patch((c) => { c.identity.loginModuleIconShape = e.target.value as "square" | "circle"; })}>
              <option value="square">Rounded square</option>
              <option value="circle">Circle</option>
            </select>
          </Field>
          <Field label="Module card — icon position">
            <select className={inp} value={cfg.identity.loginModuleIconPosition ?? "top"} onChange={(e) => patch((c) => { c.identity.loginModuleIconPosition = e.target.value as "top" | "left"; })}>
              <option value="top">Top, centered above text</option>
              <option value="left">Left, beside text</option>
            </select>
          </Field>
          <Field label="Module card — background strength">
            <select className={inp} value={cfg.identity.loginModuleCardTint ?? "medium"} onChange={(e) => patch((c) => { c.identity.loginModuleCardTint = e.target.value as "subtle" | "medium" | "bold"; })}>
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
          </Field>
          <div />
          <Field label="Trust card — icon shape">
            <select className={inp} value={cfg.identity.loginTrustIconShape ?? "circle"} onChange={(e) => patch((c) => { c.identity.loginTrustIconShape = e.target.value as "square" | "circle"; })}>
              <option value="square">Rounded square</option>
              <option value="circle">Circle</option>
            </select>
          </Field>
          <Field label="Trust card — icon position">
            <select className={inp} value={cfg.identity.loginTrustIconPosition ?? "left"} onChange={(e) => patch((c) => { c.identity.loginTrustIconPosition = e.target.value as "top" | "left"; })}>
              <option value="top">Top, centered above text</option>
              <option value="left">Left, beside text</option>
            </select>
          </Field>
          <Field label="Trust card — background strength">
            <select className={inp} value={cfg.identity.loginTrustCardTint ?? "subtle"} onChange={(e) => patch((c) => { c.identity.loginTrustCardTint = e.target.value as "subtle" | "medium" | "bold"; })}>
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
          </Field>
        </div>

        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Login Screen Layout</h3>
          <p className="text-2xs text-slate-400 sm:col-span-2">Panel split, the shape of the seam between the two panels, and an optional background behind the sign-in form. <b>Remember to click Publish</b> — the sign-in screen only reflects the published config, not the draft.</p>
          <div className="sm:col-span-2"><ImageField label="Left Panel Background Image — used behind the headline/cards AND as the full picture in “Image only” mode below" value={cfg.identity.loginImageUrl ?? ""} onChange={(v) => patch((c) => { c.identity.loginImageUrl = v; })} /></div>
          <p className="text-2xs text-slate-400 sm:col-span-2">Use a wide photo or graphic (globe, network, cityscape…). Left blank, the panel falls back to the brand-colour gradient — so if you selected <b>Image only</b> below and see just a plain gradient, upload an image here.</p>
          <Field label="Left/right split — left panel width % (30–70)">
            <input type="number" min={30} max={70} step={1} className={inp} value={cfg.identity.loginSplitPercent ?? 58} onChange={(e) => patch((c) => { c.identity.loginSplitPercent = Math.max(30, Math.min(70, Math.round(Number(e.target.value) || 58))); })} />
          </Field>
          <Field label="Left panel content">
            <select className={inp} value={cfg.identity.loginLeftMode ?? "content"} onChange={(e) => patch((c) => { c.identity.loginLeftMode = e.target.value as "content" | "image"; })}>
              <option value="content">Headline, modules &amp; trust strip over the background</option>
              <option value="image">Image only — no text (full-bleed background/pattern)</option>
            </select>
          </Field>
          <Field label="Divider style — the seam between the two panels">
            <select className={inp} value={cfg.identity.loginDividerStyle ?? "diagonal"} onChange={(e) => patch((c) => { c.identity.loginDividerStyle = e.target.value as "straight" | "diagonal" | "notch" | "zigzag"; })}>
              <option value="straight">Straight line</option>
              <option value="diagonal">Diagonal cut</option>
              <option value="notch">Diagonal with arrow notch</option>
              <option value="zigzag">Zigzag</option>
            </select>
          </Field>
          <Field label="Left panel — decorative pattern">
            <select className={inp} value={cfg.identity.loginLeftPattern ?? "waves-dots"} onChange={(e) => patch((c) => { c.identity.loginLeftPattern = e.target.value as WebsiteConfig["identity"]["loginLeftPattern"]; })}>
              <option value="none">None</option>
              <option value="dots">Dots</option>
              <option value="waves">Waves</option>
              <option value="waves-dots">Waves + Dots</option>
              <option value="grid">Grid</option>
              <option value="rings">Rings (network-style)</option>
              <option value="diagonal">Diagonal lines</option>
              <option value="mesh">Mesh (dots + grid)</option>
            </select>
          </Field>
          <div className="sm:col-span-2"><ImageField label="Right panel background image (optional — subtle pattern behind the sign-in form)" value={cfg.identity.loginRightBgImageUrl ?? ""} onChange={(v) => patch((c) => { c.identity.loginRightBgImageUrl = v; })} /></div>
          <Field label="Right background visibility % (0 = hidden, 100 = fully visible)">
            <input type="number" min={0} max={100} step={1} className={inp} value={cfg.identity.loginRightBgOpacity ?? 12} onChange={(e) => patch((c) => { c.identity.loginRightBgOpacity = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))); })} />
          </Field>
          <Field label="Right panel — decorative pattern">
            <select className={inp} value={cfg.identity.loginRightPattern ?? "dots"} onChange={(e) => patch((c) => { c.identity.loginRightPattern = e.target.value as WebsiteConfig["identity"]["loginRightPattern"]; })}>
              <option value="none">None</option>
              <option value="dots">Dots</option>
              <option value="waves">Waves</option>
              <option value="waves-dots">Waves + Dots</option>
              <option value="grid">Grid</option>
              <option value="rings">Rings</option>
              <option value="diagonal">Diagonal lines</option>
              <option value="mesh">Mesh (dots + grid)</option>
            </select>
          </Field>
        </div>

        <Repeater title="Login — Module Cards" items={cfg.identity.loginModules ?? []}
          onAdd={() => patch((c) => { (c.identity.loginModules ??= []).push({ icon: "Boxes", label: "New Module", sub: "" }); })}
          onRemove={(i) => patch((c) => { c.identity.loginModules?.splice(i, 1); })}
          render={(m: { icon: string; label: string; sub: string }, i) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={inp} placeholder="Label" value={m.label} onChange={(e) => patch((c) => { c.identity.loginModules![i].label = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. Boxes, Landmark)" value={m.icon} onChange={(e) => patch((c) => { c.identity.loginModules![i].icon = e.target.value; })} />
              <input className={inp} placeholder="Short description" value={m.sub} onChange={(e) => patch((c) => { c.identity.loginModules![i].sub = e.target.value; })} />
            </div>
          )} />

        <Repeater title="Login — Trust Strip Items" items={cfg.identity.loginTrustItems ?? []}
          onAdd={() => patch((c) => { (c.identity.loginTrustItems ??= []).push({ icon: "ShieldCheck", title: "New Point", sub: "" }); })}
          onRemove={(i) => patch((c) => { c.identity.loginTrustItems?.splice(i, 1); })}
          render={(t: { icon: string; title: string; sub: string }, i) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={inp} placeholder="Title" value={t.title} onChange={(e) => patch((c) => { c.identity.loginTrustItems![i].title = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. ShieldCheck)" value={t.icon} onChange={(e) => patch((c) => { c.identity.loginTrustItems![i].icon = e.target.value; })} />
              <input className={inp} placeholder="Short description" value={t.sub} onChange={(e) => patch((c) => { c.identity.loginTrustItems![i].sub = e.target.value; })} />
            </div>
          )} />
        </div>
      )}

      {tab === "Modules" && (
        <Repeater title={'Module Tiles — "Everything You Need"'} items={cfg.everything.items} onAdd={() => patch((c) => { c.everything.items.push({ icon: "Boxes", label: "New Module", tone: "violet" }); })} onRemove={(i) => patch((c) => { c.everything.items.splice(i, 1); })}
          render={(m: QuickModule, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Label" value={m.label} onChange={(e) => patch((c) => { c.everything.items[i].label = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. Boxes, ShoppingCart)" value={m.icon} onChange={(e) => patch((c) => { c.everything.items[i].icon = e.target.value; })} />
              <select className={inp} value={m.tone ?? "violet"} onChange={(e) => patch((c) => { c.everything.items[i].tone = e.target.value; })}>{["violet", "blue", "emerald", "orange", "rose"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <input className={inp} placeholder="Badge (optional, e.g. New)" value={m.badge ?? ""} onChange={(e) => patch((c) => { c.everything.items[i].badge = e.target.value; })} />
              <div className="sm:col-span-2"><ImageField label="Custom icon image (optional — overrides the icon)" value={m.imageUrl ?? ""} onChange={(v) => patch((c) => { c.everything.items[i].imageUrl = v; })} /></div>
            </div>
          )} />
      )}

      {tab === "Industries" && (
        <Repeater title="Industries — image, colour & icon per vertical" items={cfg.industries.items} onAdd={() => patch((c) => { c.industries.items.push({ icon: "Store", name: "New Industry", blurb: "", color: "#7c3aed" }); })} onRemove={(i) => patch((c) => { c.industries.items.splice(i, 1); })}
          render={(it: IndustryItem, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Name" value={it.name} onChange={(e) => patch((c) => { c.industries.items[i].name = e.target.value; })} />
              <input className={inp} placeholder="Icon name (e.g. Store, Pill)" value={it.icon} onChange={(e) => patch((c) => { c.industries.items[i].icon = e.target.value; })} />
              <ColorField label="Identity colour" value={it.color ?? "#7c3aed"} onChange={(v) => patch((c) => { c.industries.items[i].color = v; })} />
              <input className={inp} placeholder="Short description" value={it.blurb} onChange={(e) => patch((c) => { c.industries.items[i].blurb = e.target.value; })} />
              <div className="sm:col-span-2"><ImageField label="Industry image (optional — shown on the card)" value={it.imageUrl ?? ""} onChange={(v) => patch((c) => { c.industries.items[i].imageUrl = v; })} /></div>
            </div>
          )} />
      )}

      {tab === "Section Images" && (
        <div className={cn(card, "grid gap-5 p-5 sm:grid-cols-2")}>
          <ImageField label="Real-Time Insights — Dashboard image" value={cfg.realtime.imageUrl ?? ""} onChange={(v) => patch((c) => { c.realtime.imageUrl = v; })} />
          <ImageField label="AI card — graphic (AI circuit)" value={cfg.aiCard.imageUrl ?? ""} onChange={(v) => patch((c) => { c.aiCard.imageUrl = v; })} />
          <ImageField label="Marketing card — graphic (megaphone)" value={cfg.marketingCard.imageUrl ?? ""} onChange={(v) => patch((c) => { c.marketingCard.imageUrl = v; })} />
          <ImageField label="Customer App — illustration (cart)" value={cfg.customerApp.imageUrl ?? ""} onChange={(v) => patch((c) => { c.customerApp.imageUrl = v; })} />
          <p className="text-2xs text-slate-400 sm:col-span-2">Leave blank to keep the built-in animated placeholder. Upload from your computer or paste any image URL / <code>/uploads/...</code> path.</p>
        </div>
      )}

      {tab === "Backgrounds" && (
        <div className="space-y-3">
          <div className={cn(card, "p-3 text-2xs text-slate-500")}>Add a background image + a layered <b>overlay</b> to any section — the overlay keeps text readable and gives a premium layered look. Upload from your computer or paste a URL.</div>
          {BG_SECTIONS.map((id) => {
            const b: SectionBackground = cfg.backgrounds?.[id] ?? {};
            const setBg = (patchBg: Partial<SectionBackground>) => patch((c) => { c.backgrounds = c.backgrounds || {}; c.backgrounds[id] = { ...(c.backgrounds[id] || {}), ...patchBg }; });
            return (
              <div key={id} className={cn(card, "p-4")}>
                <div className="mb-2 text-sm font-bold text-slate-800">{SECTION_LABELS[id] ?? id}</div>
                <ImageField label="Background image" value={b.imageUrl ?? ""} onChange={(v) => setBg({ imageUrl: v })} />
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <div><label className={lbl}>Image position</label><select className={inp} value={b.imageSide ?? "full"} onChange={(e) => setBg({ imageSide: e.target.value as SectionBackground["imageSide"] })}>{[["full", "Full section"], ["left", "Left side only"], ["right", "Right side only"], ["center", "Centered band"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div><label className={lbl}>Overlay / effect</label><select className={inp} value={b.overlay ?? "none"} onChange={(e) => setBg({ overlay: e.target.value })}>{OVERLAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div><label className={lbl}>Text colour</label><select className={inp} value={b.textColor ?? "auto"} onChange={(e) => setBg({ textColor: e.target.value as SectionBackground["textColor"] })}><option value="auto">Auto (theme)</option><option value="light">Light / white text</option><option value="dark">Dark text</option></select></div>
                  <div><label className={lbl}>Dim image (%)</label><input type="number" min={0} max={100} className={inp} value={b.dim ?? 0} onChange={(e) => setBg({ dim: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-end gap-2 pb-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={!!b.blur} onChange={(e) => setBg({ blur: e.target.checked })} /> Blur</label>
                    <label className="flex items-end gap-2 pb-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={!!b.fixed} onChange={(e) => setBg({ fixed: e.target.checked })} /> Parallax</label>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div><label className={lbl}>Design pattern (dynamic, theme-coloured)</label><select className={inp} value={b.pattern ?? "none"} onChange={(e) => setBg({ pattern: e.target.value as SectionBackground["pattern"] })}>{[["none", "None"], ["waves", "Flowing Waves"], ["dots", "Halftone Dots"], ["waves-dots", "Waves + Dots"], ["grid", "Grid Lines"], ["mesh", "Grid + Dots (Mesh)"], ["rings", "Concentric Rings"], ["diagonal", "Diagonal Streaks"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div><label className={lbl}>Pattern position</label><select className={inp} value={b.patternSide ?? "full"} onChange={(e) => setBg({ patternSide: e.target.value as SectionBackground["patternSide"] })}>{[["full", "Full width"], ["left", "Left half (right free for images)"], ["right", "Right half (left free for images)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <label className="flex items-end gap-2 pb-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={b.patternAnimate !== false} onChange={(e) => setBg({ patternAnimate: e.target.checked })} /> Animate pattern</label>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Tip: leave <b>Text colour = Auto</b> — it follows the overlay automatically. <b>Image position</b> = Left/Right places the photo on one side only (the rest stays clear for content). The <b>Design pattern</b> is drawn live in your theme colours (no image needed) — set <b>position = Left half</b> to keep the other side free for images, and toggle <b>Animate pattern</b> for motion.</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Media" && <MediaLibrary flash={flash} />}

      {tab === "Homepage Builder" && (
        <div className={cn(card, "p-5")}>
          <p className="mb-3 text-2xs text-slate-500">Reorder, show or hide homepage sections. Changes go live when you <b>Publish</b>.</p>
          <div className="space-y-1.5">
            {cfg.homeSections.map((s, i) => (
              <div key={s.id} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", s.enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70")}>
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800"><span className="w-5 text-2xs text-slate-400">{i + 1}</span>{SECTION_LABELS[s.id] ?? s.id}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => patch((c) => { c.homeSections[i].enabled = !c.homeSections[i].enabled; })} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold", s.enabled ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-500 hover:bg-slate-100")}>{s.enabled ? <><Eye className="h-3.5 w-3.5" /> Shown</> : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}</button>
                  <button disabled={i === 0} onClick={() => patch((c) => { const a = c.homeSections; [a[i - 1], a[i]] = [a[i], a[i - 1]]; })} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button disabled={i === cfg.homeSections.length - 1} onClick={() => patch((c) => { const a = c.homeSections; [a[i + 1], a[i]] = [a[i], a[i + 1]]; })} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Banner" && (
        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <Field label="Banner Style"><select className={inp} value={cfg.hero.style ?? "split"} onChange={(e) => patch((c) => { c.hero.style = e.target.value as "gradient" | "image" | "split"; })}><option value="split">Split (text + product image)</option><option value="gradient">Gradient / mesh</option><option value="image">Background image</option></select></Field>
          <Field label="Content panel (makes text pop over a background image)"><select className={inp} value={cfg.hero.contentPanel ?? "glass"} onChange={(e) => patch((c) => { c.hero.contentPanel = e.target.value as "none" | "glass" | "dark" | "light"; })}><option value="glass">Glass (frosted) — recommended</option><option value="dark">Dark panel</option><option value="light">Light panel</option><option value="none">None (text directly on image)</option></select></Field>
          <Field label="Rotating words (comma-separated)"><input className={inp} value={(cfg.hero.rotatingWords ?? []).join(", ")} onChange={(e) => patch((c) => { c.hero.rotatingWords = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); })} /></Field>
          <ImageField label="Background Image (optional)" value={cfg.hero.backgroundImage ?? ""} onChange={(v) => patch((c) => { c.hero.backgroundImage = v; })} />
          <ImageField label="Hero / Product Image (optional)" value={cfg.hero.heroImage ?? ""} onChange={(v) => patch((c) => { c.hero.heroImage = v; })} />
          <Field label="Badge"><input className={inp} value={cfg.hero.badge} onChange={(e) => patch((c) => { c.hero.badge = e.target.value; })} /></Field>
          <div className="hidden sm:block" />
          <Field label="Title — lead"><input className={inp} value={cfg.hero.titleLead} onChange={(e) => patch((c) => { c.hero.titleLead = e.target.value; })} /></Field>
          <Field label="Title — highlighted"><input className={inp} value={cfg.hero.titleHighlight} onChange={(e) => patch((c) => { c.hero.titleHighlight = e.target.value; })} /></Field>
          <Field label="Title — tail"><input className={inp} value={cfg.hero.titleTail} onChange={(e) => patch((c) => { c.hero.titleTail = e.target.value; })} /></Field>
          <div className="hidden sm:block" />
          <Field label="Subtitle" full><textarea className={cn(inp, "h-20 py-2")} value={cfg.hero.subtitle} onChange={(e) => patch((c) => { c.hero.subtitle = e.target.value; })} /></Field>
          <Field label="Primary CTA label"><input className={inp} value={cfg.hero.primaryCta.label} onChange={(e) => patch((c) => { c.hero.primaryCta.label = e.target.value; })} /></Field>
          <Field label="Primary CTA link"><input className={inp} value={cfg.hero.primaryCta.href} onChange={(e) => patch((c) => { c.hero.primaryCta.href = e.target.value; })} /></Field>
          <Field label="Secondary CTA label"><input className={inp} value={cfg.hero.secondaryCta.label} onChange={(e) => patch((c) => { c.hero.secondaryCta.label = e.target.value; })} /></Field>
          <Field label="Secondary CTA link"><input className={inp} value={cfg.hero.secondaryCta.href} onChange={(e) => patch((c) => { c.hero.secondaryCta.href = e.target.value; })} /></Field>
          <Field label="Trust points (comma-separated)" full><input className={inp} value={cfg.hero.trustPoints.join(", ")} onChange={(e) => patch((c) => { c.hero.trustPoints = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); })} /></Field>
        </div>
      )}

      {tab === "Menus" && (
        <Repeater title="Header Navigation" items={cfg.nav} onAdd={() => patch((c) => { c.nav.push({ label: "New", href: "/" }); })} onRemove={(i) => patch((c) => { c.nav.splice(i, 1); })}
          render={(n: NavItem, i) => (<div className="grid grid-cols-2 gap-2"><input className={inp} placeholder="Label" value={n.label} onChange={(e) => patch((c) => { c.nav[i].label = e.target.value; })} /><input className={inp} placeholder="Link" value={n.href} onChange={(e) => patch((c) => { c.nav[i].href = e.target.value; })} /></div>)} />
      )}

      {tab === "Clients" && (
        <div className="space-y-4">
          <div className={cn(card, "p-5")}><Field label="Client Strip Title"><input className={inp} value={cfg.clientsTitle} onChange={(e) => patch((c) => { c.clientsTitle = e.target.value; })} /></Field></div>
          <Repeater title="Client Logos (scrolling strip)" items={cfg.clients} onAdd={() => patch((c) => { c.clients.push({ name: "New Client" }); })} onRemove={(i) => patch((c) => { c.clients.splice(i, 1); })}
            render={(cl: ClientLogo, i) => (<div className="grid gap-2"><input className={inp} placeholder="Client name" value={cl.name} onChange={(e) => patch((c) => { c.clients[i].name = e.target.value; })} /><ImageField label="Logo image (optional)" value={cl.logoUrl ?? ""} onChange={(v) => patch((c) => { c.clients[i].logoUrl = v; })} /></div>)} />
        </div>
      )}

      {tab === "Spotlights" && (
        <Repeater title="Feature Spotlights (alternating image + text)" items={cfg.spotlights} onAdd={() => patch((c) => { c.spotlights.push({ badge: "New", icon: "Sparkles", title: "New spotlight", subtitle: "", points: ["Point one"], imageSide: "right", imageUrl: "" }); })} onRemove={(i) => patch((c) => { c.spotlights.splice(i, 1); })}
          render={(s: Spotlight, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Badge" value={s.badge ?? ""} onChange={(e) => patch((c) => { c.spotlights[i].badge = e.target.value; })} />
              <input className={inp} placeholder="Icon (e.g. Sparkles, Boxes, Smartphone)" value={s.icon} onChange={(e) => patch((c) => { c.spotlights[i].icon = e.target.value; })} />
              <input className={cn(inp, "sm:col-span-2")} placeholder="Title" value={s.title} onChange={(e) => patch((c) => { c.spotlights[i].title = e.target.value; })} />
              <textarea className={cn(inp, "sm:col-span-2 h-16 py-2")} placeholder="Subtitle" value={s.subtitle} onChange={(e) => patch((c) => { c.spotlights[i].subtitle = e.target.value; })} />
              <textarea className={cn(inp, "sm:col-span-2 h-16 py-2")} placeholder="Bullet points (one per line)" value={s.points.join("\n")} onChange={(e) => patch((c) => { c.spotlights[i].points = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); })} />
              <input className={inp} placeholder="Image URL (optional)" value={s.imageUrl ?? ""} onChange={(e) => patch((c) => { c.spotlights[i].imageUrl = e.target.value; })} />
              <select className={inp} value={s.imageSide} onChange={(e) => patch((c) => { c.spotlights[i].imageSide = e.target.value as "left" | "right"; })}><option value="right">Image on right</option><option value="left">Image on left</option></select>
            </div>
          )} />
      )}

      {tab === "Pricing" && (
        <Repeater title="Pricing Plans" items={cfg.pricing.plans} onAdd={() => patch((c) => { c.pricing.plans.push({ name: "New Plan", price: "₹0", period: "/mo", tagline: "", features: ["Feature"], cta: { label: "Choose", href: "/contact?type=trial", style: "outline" } }); })} onRemove={(i) => patch((c) => { c.pricing.plans.splice(i, 1); })}
          render={(p: PricingPlan, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inp} placeholder="Name" value={p.name} onChange={(e) => patch((c) => { c.pricing.plans[i].name = e.target.value; })} />
              <input className={inp} placeholder="Tagline" value={p.tagline} onChange={(e) => patch((c) => { c.pricing.plans[i].tagline = e.target.value; })} />
              <input className={inp} placeholder="Price" value={p.price} onChange={(e) => patch((c) => { c.pricing.plans[i].price = e.target.value; })} />
              <input className={inp} placeholder="Period" value={p.period} onChange={(e) => patch((c) => { c.pricing.plans[i].period = e.target.value; })} />
              <label className="col-span-full flex items-center gap-2 text-2xs font-semibold text-slate-600"><input type="checkbox" checked={!!p.featured} onChange={(e) => patch((c) => { c.pricing.plans[i].featured = e.target.checked; })} /> Featured (Most Popular)</label>
              <textarea className={cn(inp, "col-span-full h-16 py-2")} placeholder="Features (one per line)" value={p.features.join("\n")} onChange={(e) => patch((c) => { c.pricing.plans[i].features = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); })} />
              <input className={inp} placeholder="CTA label" value={p.cta.label} onChange={(e) => patch((c) => { c.pricing.plans[i].cta.label = e.target.value; })} />
              <input className={inp} placeholder="CTA link" value={p.cta.href} onChange={(e) => patch((c) => { c.pricing.plans[i].cta.href = e.target.value; })} />
            </div>
          )} />
      )}

      {tab === "Testimonials" && (
        <Repeater title="Customer Testimonials" items={cfg.testimonials.items} onAdd={() => patch((c) => { c.testimonials.items.push({ quote: "", author: "", role: "", company: "" }); })} onRemove={(i) => patch((c) => { c.testimonials.items.splice(i, 1); })}
          render={(t: Testimonial, i) => (
            <div className="grid gap-2">
              <textarea className={cn(inp, "h-16 py-2")} placeholder="Quote" value={t.quote} onChange={(e) => patch((c) => { c.testimonials.items[i].quote = e.target.value; })} />
              <div className="grid grid-cols-3 gap-2">
                <input className={inp} placeholder="Author" value={t.author} onChange={(e) => patch((c) => { c.testimonials.items[i].author = e.target.value; })} />
                <input className={inp} placeholder="Role" value={t.role} onChange={(e) => patch((c) => { c.testimonials.items[i].role = e.target.value; })} />
                <input className={inp} placeholder="Company" value={t.company} onChange={(e) => patch((c) => { c.testimonials.items[i].company = e.target.value; })} />
              </div>
            </div>
          )} />
      )}

      {tab === "SEO" && (
        <div className={cn(card, "grid gap-4 p-5")}>
          <Field label="Meta Title"><input className={inp} value={cfg.seo.title} onChange={(e) => patch((c) => { c.seo.title = e.target.value; })} /></Field>
          <Field label="Meta Description"><textarea className={cn(inp, "h-20 py-2")} value={cfg.seo.description} onChange={(e) => patch((c) => { c.seo.description = e.target.value; })} /></Field>
          <Field label="Keywords"><input className={inp} value={cfg.seo.keywords} onChange={(e) => patch((c) => { c.seo.keywords = e.target.value; })} /></Field>
          <Field label="OG Image URL"><input className={inp} value={cfg.seo.ogImage ?? ""} onChange={(e) => patch((c) => { c.seo.ogImage = e.target.value; })} /></Field>
        </div>
      )}

      {tab === "Footer" && (
        <div className={cn(card, "grid gap-4 p-5 sm:grid-cols-2")}>
          <Field label="About" full><textarea className={cn(inp, "h-20 py-2")} value={cfg.footer.about} onChange={(e) => patch((c) => { c.footer.about = e.target.value; })} /></Field>
          <Field label="Contact Email"><input className={inp} value={cfg.footer.contactEmail} onChange={(e) => patch((c) => { c.footer.contactEmail = e.target.value; })} /></Field>
          <Field label="Contact Phone"><input className={inp} value={cfg.footer.contactPhone} onChange={(e) => patch((c) => { c.footer.contactPhone = e.target.value; })} /></Field>
          <Field label="Address"><input className={inp} value={cfg.footer.address} onChange={(e) => patch((c) => { c.footer.address = e.target.value; })} /></Field>
          <Field label="Copyright"><input className={inp} value={cfg.footer.copyright} onChange={(e) => patch((c) => { c.footer.copyright = e.target.value; })} /></Field>
          <Field label="Social links (Label|URL, comma-separated)" full><input className={inp} value={cfg.footer.social.map((s) => `${s.label}|${s.href}`).join(", ")} onChange={(e) => patch((c) => { c.footer.social = e.target.value.split(",").map((p) => { const [label, href] = p.split("|"); return { label: (label || "").trim(), href: (href || "#").trim() }; }).filter((s) => s.label); })} /></Field>
        </div>
      )}

      {tab === "Leads" && <LeadsView flash={flash} />}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className={lbl}>{label}</label>{children}</div>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><label className={lbl}>{label}</label><div className="flex items-center gap-2"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" /><input className={inp} value={value} onChange={(e) => onChange(e.target.value)} /></div></div>;
}
function Repeater<T>({ title, items, onAdd, onRemove, render }: { title: string; items: T[]; onAdd: () => void; onRemove: (i: number) => void; render: (item: T, i: number) => React.ReactNode }) {
  return (
    <div className={cn(card, "p-5")}>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800">{title}</h3><button onClick={onAdd} className={btnO}><Plus className="h-3.5 w-3.5" /> Add</button></div>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-2xs font-semibold text-slate-400">#{i + 1}</span><button onClick={() => onRemove(i)} className="text-rose-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div>
            {render(it, i)}
          </div>
        ))}
        {!items.length && <p className="py-6 text-center text-2xs text-slate-400">Nothing yet — click Add.</p>}
      </div>
    </div>
  );
}

async function uploadImage(file: File): Promise<{ ok: boolean; url?: string; message?: string }> {
  const fd = new FormData(); fd.append("file", file);
  return fetch("/api/platform/website/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ ok: false, message: "Upload failed." }));
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => { setBusy(true); setErr(""); const j = await uploadImage(file); setBusy(false); if (j.ok && j.url) onChange(j.url); else setErr(j.message || "Upload failed."); };
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}</div>
        <div className="min-w-0 flex-1">
          <input className={inp} placeholder="Image URL or /uploads/… path" value={value} onChange={(e) => onChange(e.target.value)} />
          <div className="mt-1.5 flex items-center gap-3">
            <button type="button" onClick={() => ref.current?.click()} className={btnO}><Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload from computer"}</button>
            {value && <button type="button" onClick={() => onChange("")} className="text-2xs font-semibold text-rose-500 hover:text-rose-700">Remove</button>}
          </div>
          {err && <p className="mt-1 text-2xs text-rose-500">{err}</p>}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }} />
      </div>
    </div>
  );
}

function MediaLibrary({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Array<{ name: string; url: string; at: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const j = await fetch("/api/platform/website/media", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  const up = async (file: File) => { setBusy(true); const j = await uploadImage(file); setBusy(false); if (j.ok) { flash("Image uploaded."); load(); } else flash(j.message || "Upload failed."); };
  const del = async (name: string) => { await fetch(`/api/platform/website/media?name=${encodeURIComponent(name)}`, { method: "DELETE" }); load(); };
  const copy = (url: string) => { navigator.clipboard?.writeText(url); setCopied(url); window.setTimeout(() => setCopied(""), 1500); };
  return (
    <div className={cn(card, "p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-sm font-bold text-slate-800">Media Library</h3><p className="text-2xs text-slate-400">Upload images from your computer, then copy a URL to use anywhere.</p></div>
        <button onClick={() => ref.current?.click()} className={btn}><Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload Image"}</button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); e.currentTarget.value = ""; }} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {rows.map((m) => (
          <div key={m.name} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={m.url} alt={m.name} className="aspect-square w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-2 py-1.5 opacity-0 transition group-hover:opacity-100">
              <button onClick={() => copy(m.url)} title="Copy URL" className="text-white">{copied === m.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
              <span className="truncate text-[9px] text-white/80">{m.name}</span>
              <button onClick={() => del(m.name)} title="Delete" className="text-rose-300 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="col-span-full py-10 text-center text-2xs text-slate-400">No images yet — click "Upload Image" to add from your computer.</p>}
      </div>
    </div>
  );
}

function LeadsView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const load = useCallback(async () => { const j = await fetch("/api/platform/website/leads", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRows(j.rows); }, []);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (id: string, status: string) => { const j = await fetch("/api/platform/website/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).then((r) => r.json()).catch(() => ({ ok: false })); if (j.ok) { flash("Lead updated."); load(); } };
  const tone = (t: string) => t === "trial" ? "bg-emerald-100 text-emerald-700" : t === "demo" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600";
  return (
    <div className={cn(card, "overflow-hidden")}>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500"><th className="px-3 py-2.5">When</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Company</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Status</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-2xs text-slate-500">{new Date(l.at).toLocaleString()}</td>
              <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", tone(l.type))}>{l.type}</span></td>
              <td className="px-3 py-2 font-medium text-slate-900">{l.name}<div className="text-2xs text-slate-400">{l.industry}</div></td>
              <td className="px-3 py-2 text-2xs text-slate-600">{l.email}<div className="text-slate-400">{l.phone}</div></td>
              <td className="px-3 py-2 text-2xs text-slate-600">{l.company}</td>
              <td className="px-3 py-2 text-2xs text-slate-600">{l.plan}</td>
              <td className="px-3 py-2"><select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} className="rounded border border-slate-300 px-1.5 py-1 text-2xs">{["New", "Contacted", "Qualified", "Converted", "Closed"].map((s) => <option key={s}>{s}</option>)}</select></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No leads yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
