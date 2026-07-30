"use client";

/** Reveal-on-scroll wrapper (dependency-free — IntersectionObserver + CSS). */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }); }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("transition-all duration-700 ease-out will-change-transform", shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
