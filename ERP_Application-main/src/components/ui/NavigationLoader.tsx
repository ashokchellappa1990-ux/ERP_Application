"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppLoader } from "@/components/ui/AppLoader";

// Minimum time the loader stays visible so fast navigations are still seen.
const MIN_MS = 500;

/**
 * Client-side navigation loader. Shows the retail barcode loader on every in-app
 * route change (link clicks + browser back/forward), and hides it once the new
 * route commits (respecting a minimum display time).
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const shownAt = useRef(0);
  const mounted = useRef(false);

  function show() {
    shownAt.current = Date.now();
    setLoading(true);
  }

  // Hide when the route actually changes.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const remaining = Math.max(0, MIN_MS - (Date.now() - shownAt.current));
    const t = setTimeout(() => setLoading(false), remaining);
    return () => clearTimeout(t);
  }, [pathname]);

  // Detect navigation starts.
  useEffect(() => {
    function modified(e: MouseEvent) {
      return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    }
    function onClick(e: MouseEvent) {
      if (modified(e)) return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (or pure hash change) — no navigation to load for.
      if (url.pathname === window.location.pathname) return;
      show();
    }
    function onPop() {
      show();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Safety: never get stuck.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  if (!loading) return null;
  return <AppLoader fullScreen />;
}
