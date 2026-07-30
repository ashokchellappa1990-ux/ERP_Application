"use client";

import { qrSvgString, type QrRenderOptions } from "@/lib/masters/qr";

/** Renders a QR code for `value`. Single source of truth is `qrSvgString`, so
 * the on-screen preview and the printed sticker always match. */
export function QrCode({ value, size = 120, className, options }: { value: string; size?: number; className?: string; options?: QrRenderOptions }) {
  return (
    <span
      className={className}
      role="img"
      aria-label={`QR code for ${value}`}
      dangerouslySetInnerHTML={{ __html: qrSvgString(value, size, options) }}
    />
  );
}
