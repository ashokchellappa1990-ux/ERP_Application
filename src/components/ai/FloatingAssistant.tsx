"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { AiChat } from "./AiChat";

/** Global AI assistant — its trigger sits inline in the Topbar next to the
 *  notification bell (rendered there via <FloatingAssistant />), unless
 *  turned off via General Settings > System Behaviour > Show AI Copilot
 *  Bubble. The chat panel itself still floats (fixed) below the header. */
export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const { flags } = useGeneralConfig();

  if (!flags.showAiCopilot) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="AI Copilot"
        aria-label="AI Copilot"
        className="touch-target grid place-items-center rounded-md border border-border bg-surface text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <Sparkles className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div className={cn("fixed right-5 top-[calc(var(--topbar-height)+0.75rem)] z-40 flex w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl", "h-[min(78vh,620px)]")}>
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
