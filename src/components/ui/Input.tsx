import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InfoTip } from "./InfoTip";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  info?: string;
  sample?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, hint, error, leadingIcon, trailingIcon, info, sample, id, ...props },
    ref
  ) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor={inputId} className="text-[13px] font-semibold text-foreground">
              {label}
            </label>
            {info && <InfoTip text={info} sample={sample} />}
          </div>
        )}
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-10 w-full rounded-md border bg-surface text-sm font-medium text-foreground shadow-xs transition",
              "placeholder:font-normal placeholder:text-subtle",
              "focus:border-primary focus:outline-none focus:shadow-focus",
              "disabled:cursor-not-allowed disabled:opacity-60",
              leadingIcon ? "pl-9" : "pl-3",
              trailingIcon ? "pr-9" : "pr-3",
              error ? "border-danger" : "border-border-strong hover:border-primary/40",
              className
            )}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
              {trailingIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-subtle">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
