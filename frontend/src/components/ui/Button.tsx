import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand-600 hover:bg-brand-700 text-white disabled:bg-surface-hover disabled:text-content-muted",
  secondary:
    "bg-surface-elevated hover:bg-surface-hover border border-border text-content-primary disabled:opacity-50",
  ghost:
    "bg-transparent hover:bg-surface-hover text-content-secondary hover:text-content-primary disabled:opacity-50",
  danger:
    "bg-error hover:bg-red-700 text-white disabled:opacity-50",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-md gap-1",
  md: "px-4 py-2 text-sm rounded-lg gap-1.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
