import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { InfoTip } from "./InfoTip";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: SelectOption[];
  leadingIcon?: ReactNode;
  info?: string;
  sample?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, hint, placeholder, options, leadingIcon, info, sample, id, ...props },
    ref
  ) => {
    const selectId = id ?? props.name;
    return (
      <div className="w-full">
        {label && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor={selectId} className="text-[13px] font-semibold text-foreground">
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
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "h-10 w-full appearance-none rounded-md border bg-surface text-sm font-medium shadow-xs transition",
              "focus:border-primary focus:outline-none focus:shadow-focus",
              "disabled:cursor-not-allowed disabled:opacity-60",
              leadingIcon ? "pl-9" : "pl-3",
              "pr-9",
              error ? "border-danger" : "border-border-strong hover:border-primary/40",
              props.value ? "text-foreground" : "text-subtle",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} className="text-foreground">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
Select.displayName = "Select";
