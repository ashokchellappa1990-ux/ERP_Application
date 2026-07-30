import Link from "next/link";
import { Orbit, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Youtube, type LucideIcon } from "lucide-react";
import type { WebsiteConfig } from "@/lib/website/config";

const SOCIAL_ICON: Record<string, LucideIcon> = { Facebook, X: Twitter, Twitter, LinkedIn: Linkedin, Instagram, YouTube: Youtube };

export function SiteFooter({ config }: { config: WebsiteConfig }) {
  const f = config.footer;
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand + about + social */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 font-bold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white"><Orbit className="h-5 w-5" /></span><span className="text-lg tracking-tight">{config.identity.logoText}</span></div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">{f.about}</p>
            <div className="mt-4 flex gap-2">
              {f.social.map((s) => { const Ic = SOCIAL_ICON[s.label] ?? Twitter; return <a key={s.label} href={s.href} aria-label={s.label} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-gradient-to-br hover:from-primary hover:to-secondary hover:text-white"><Ic className="h-4 w-4" /></a>; })}
            </div>
          </div>
          {/* Link columns */}
          {f.columns.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                {col.links.map((l) => <li key={l.label}><Link href={l.href} className="transition hover:text-white">{l.label}</Link></li>)}
              </ul>
            </div>
          ))}
          {/* Contact */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-semibold text-white">Contact Us</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              {f.contactPhone && <li><a href={`tel:${f.contactPhone}`} className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4 text-primary" /> {f.contactPhone}</a></li>}
              {f.contactEmail && <li><a href={`mailto:${f.contactEmail}`} className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4 text-primary" /> {f.contactEmail}</a></li>}
              {f.address && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {f.address}</li>}
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">{f.copyright}</div>
      </div>
    </footer>
  );
}
