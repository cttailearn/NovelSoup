import { type ReactNode } from "react";

type BadgeVariant = "default" | "brand" | "success" | "warning" | "error";

interface Props {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-content-secondary",
  brand: "bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
};

export function Badge({ children, variant = "default", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
