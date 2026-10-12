import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { InfoTip } from "./InfoTip";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  info?: string;
  sample?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, info, sample, id, ...props }, ref) => {
    const tid = id ?? props.name;
    return (
      <div className="w-full">
        {label && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor={tid} className="text-[13px] font-semibold text-foreground">
              {label}
            </label>
            {info && <InfoTip text={info} sample={sample} />}
          </div>
        )}
        <textarea
          ref={ref}
          id={tid}
          rows={props.rows ?? 3}
          className={cn(
            "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground transition",
            "placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus",
            error ? "border-danger" : "border-border-strong",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
