"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ScopeBar } from "@/components/scope/ScopeBar";
import { useScope } from "@/components/scope/ScopeProvider";
import { FloatingAssistant } from "@/components/ai/FloatingAssistant";
import { CommandPalette } from "@/components/ai/CommandPalette";

/**
 * The persistent enterprise frame: fixed sidebar + sticky topbar + scrollable
 * content. Collapsible on desktop, off-canvas drawer on mobile/tablet.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Re-mount page content when the user changes the business/branch scope so every
  // list/landing page re-fetches its data for the new branch selection.
  const { version: scopeVersion } = useScope();

  // One menu button: collapse/expand the sidebar on desktop, open the drawer on mobile.
  function handleMenu() {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setCollapsed((c) => !c);
    } else {
      setMobileOpen(true);
    }
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={handleMenu} />
        <ScopeBar />
        <main className="flex-1 overflow-y-auto">
          <div key={scopeVersion} className="mx-auto max-w-[1600px] p-4 md:p-6">{children}</div>
        </main>
      </div>
      {/* Global AI Copilot (floating) + Command Center palette (Ctrl/⌘+K) — every page. */}
      <FloatingAssistant />
      <CommandPalette />
    </div>
  );
}
