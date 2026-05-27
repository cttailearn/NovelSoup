import { type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const baseFieldClasses =
  "w-full bg-surface-elevated border border-border rounded-md px-3 py-2 text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600 disabled:opacity-50 transition-colors";

export function Input({ label, error, className = "", ...rest }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-content-secondary block">{label}</label>}
      <input className={`${baseFieldClasses} ${error ? "border-red-500" : ""} ${className}`} {...rest} />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = "", ...rest }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-content-secondary block">{label}</label>}
      <textarea
        className={`${baseFieldClasses} resize-none ${error ? "border-red-500" : ""} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
