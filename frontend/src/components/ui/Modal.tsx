import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, icon, children, footer, width = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
      <div
        className={`bg-surface-elevated border border-border rounded-xl w-full ${widthClasses[width]} max-h-[90vh] overflow-hidden flex flex-col shadow-lg`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <h2 className="text-lg font-semibold text-content-primary">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded text-content-muted">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
