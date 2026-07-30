"use client";

import { useEffect, useState } from "react";

/** Cycles through words with a fade/slide — the classic modern-SaaS hero flourish. */
export function RotatingWords({ words, className }: { words: string[]; className?: string }) {
  const list = words.length ? words : ["Business"];
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => {
      setShow(false);
      window.setTimeout(() => { setI((p) => (p + 1) % list.length); setShow(true); }, 300);
    }, 2200);
    return () => window.clearInterval(id);
  }, [list.length]);
  return (
    <span className="relative inline-block align-bottom">
      <span className={`inline-block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"} ${className ?? ""}`}>
        {list[i]}
      </span>
    </span>
  );
}
