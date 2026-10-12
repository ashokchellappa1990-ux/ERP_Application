"use client";

/** Animated counter that counts up when scrolled into view. */
import { useEffect, useRef, useState } from "react";

export function Counter({ value, suffix = "", className }: { value: string; suffix?: string; className?: string }) {
  const target = parseFloat(value);
  const isNum = !Number.isNaN(target);
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(isNum ? 0 : value);

  useEffect(() => {
    if (!isNum) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const dur = 1400, start = performance.now();
      const decimals = (value.split(".")[1] || "").length;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN((target * eased).toFixed(decimals));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [isNum, target, value]);

  return <span ref={ref} className={className}>{n}{suffix}</span>;
}
