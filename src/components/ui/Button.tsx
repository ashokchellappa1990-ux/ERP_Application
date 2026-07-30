import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger";
type Size = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-primary-foreground shadow-sm hover:brightness-105 hover:shadow-md",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary-hover shadow-xs",
  accent: "bg-accent text-accent-foreground hover:brightness-95 shadow-xs",
  outline:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-danger text-white hover:brightness-95 shadow-xs",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-md gap-2 rounded-lg",
  xl: "h-14 px-7 text-lg gap-2.5 rounded-lg", // POS-sized
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", block, type, ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:shadow-focus",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.98]",
        variantClasses[variant],
        sizeClasses[size],
        block && "w-full",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
