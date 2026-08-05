"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { AiChat } from "./AiChat";

/** Global floating AI assistant — available on every ERP page (mounted in AppShell),
 *  unless turned off via General Settings > System Behaviour > Show AI Copilot Bubble. */
export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const { flags } = useGeneralConfig();

  if (!flags.showAiCopilot) return null;

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} title="AI Copilot" className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-xl shadow-primary/30 transition hover:scale-105">
          <Sparkles className="h-6 w-6" />
          <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-2xs font-semibold text-background opacity-0 transition group-hover:opacity-100">Ask AI Copilot</span>
        </button>
      )}
      {open && (
        <div className={cn("fixed bottom-5 right-5 z-40 flex w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl", "h-[min(78vh,620px)]")}>
          <div className="flex items-center justify-between bg-brand-gradient px-3.5 py-2.5 text-white">
            <span className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4.5 w-4.5" /> AI Copilot</span>
            <div className="flex items-center gap-0.5">
              <Link href="/copilot" onClick={() => setOpen(false)} title="Open full screen" className="grid h-8 w-8 place-items-center rounded-md text-white/90 hover:bg-white/15"><Maximize2 className="h-4 w-4" /></Link>
              <button onClick={() => setOpen(false)} title="Close" className="grid h-8 w-8 place-items-center rounded-md text-white/90 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <AiChat conversationId={convId} onConversationChange={setConvId} compact />
          </div>
        </div>
      )}
    </>
  );
}
