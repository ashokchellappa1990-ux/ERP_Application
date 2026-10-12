"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Mail, MessageSquare, Smartphone, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import {
  cloneNotificationConfig, applyNotificationConfig, CHANNEL_META, CHANNEL_FIELDS,
  NOTIFICATION_EVENTS, type NotificationConfigData,
} from "@/lib/settings/notificationConfig";
import { cn } from "@/lib/cn";

type ChannelKey = keyof NotificationConfigData;
const CHANNELS: { key: ChannelKey; icon: typeof Mail }[] = [
  { key: "email", icon: Mail },
  { key: "sms", icon: MessageSquare },
  { key: "whatsapp", icon: MessageCircle },
  { key: "app", icon: Smartphone },
];

export function NotificationSettings() {
  const [cfg, setCfg] = useState<NotificationConfigData>(() => cloneNotificationConfig());
  const [active, setActive] = useState<ChannelKey>("email");
  const [saved, setSaved] = useState(false);
  const ch = cfg[active];

  const setEnabled = (v: boolean) => setCfg((c) => ({ ...c, [active]: { ...c[active], enabled: v } }));
  const setField = (k: string, v: string) => setCfg((c) => ({ ...c, [active]: { ...c[active], fields: { ...c[active].fields, [k]: v } } }));
  const setEvent = (k: string, v: boolean) => setCfg((c) => ({ ...c, [active]: { ...c[active], events: { ...c[active].events, [k]: v } } }));

  function save() {
    applyNotificationConfig(cfg);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Notification</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Bell className="h-5 w-5 text-primary" /> Notification Settings</h1>
          <p className="mt-0.5 text-sm text-muted">Configure how customers &amp; staff are notified — E-Mail, Message (SMS) and App (Push).</p>
        </div>
        <Button size="md" onClick={save}><CheckCircle2 className="h-4 w-4" /> Save Settings</Button>
      </div>

      {/* channel tabs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map(({ key, icon: Icon }) => {
          const c = cfg[key];
          const isActive = active === key;
          return (
            <button key={key} onClick={() => setActive(key)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", isActive ? "border-primary bg-primary-subtle/40 shadow-sm" : "border-border bg-surface hover:border-primary/40")}>
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", isActive ? "bg-brand-gradient text-white" : "bg-primary-subtle text-primary")}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-foreground">{CHANNEL_META[key].label}<Badge tone={c.enabled ? "success" : "neutral"}>{c.enabled ? "On" : "Off"}</Badge></span>
                <span className="block truncate text-2xs text-muted">{CHANNEL_META[key].desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* channel enable */}
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <span><span className="block text-sm font-semibold text-foreground">Enable {CHANNEL_META[active].label}</span><span className="text-2xs text-muted">{CHANNEL_META[active].desc}</span></span>
        <Switch checked={ch.enabled} onChange={setEnabled} aria-label={`Enable ${CHANNEL_META[active].label}`} />
      </label>

      {/* provider config */}
      <div className={cn("rounded-2xl border border-border bg-card shadow-sm transition", !ch.enabled && "opacity-50")}>
        <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><Send className="h-4 w-4 text-primary" /> {CHANNEL_META[active].label} — Provider & Sender</div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNEL_FIELDS[active].map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}</label>
              {f.options ? (
                <select value={ch.fields[f.key] ?? ""} disabled={!ch.enabled} onChange={(e) => setField(f.key, e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none disabled:opacity-60">
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type === "password" ? "password" : "text"} value={ch.fields[f.key] ?? ""} disabled={!ch.enabled} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none disabled:opacity-60" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* events */}
      <div className={cn("rounded-2xl border border-border bg-card shadow-sm transition", !ch.enabled && "opacity-50")}>
        <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><Bell className="h-4 w-4 text-primary" /> Events sent via {CHANNEL_META[active].label}</div>
        <div className="divide-y divide-border">
          {NOTIFICATION_EVENTS.map((e) => (
            <div key={e.key} className="flex items-center justify-between gap-3 px-5 py-3">
              <span><span className="block text-sm font-medium text-foreground">{e.label}</span><span className="text-2xs text-muted">{e.desc}</span></span>
              <Switch checked={!!ch.events[e.key] && ch.enabled} disabled={!ch.enabled} onChange={(v) => setEvent(e.key, v)} aria-label={`${e.label} via ${CHANNEL_META[active].label}`} />
            </div>
          ))}
        </div>
      </div>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Senders read these toggles — a business event fires on a channel only when both the channel and that event are enabled here.</p>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">Notification settings saved</p><p className="text-2xs text-muted">Applied to all channels.</p>
          </div>
        </div>
      )}
    </div>
  );
}
