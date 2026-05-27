import { type ReactNode } from "react";
import { FileText } from "lucide-react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = <FileText size={48} className="opacity-30" />,
  title,
  description,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="text-content-muted mb-4">{icon}</div>
      <p className="text-sm text-content-secondary mb-1">{title}</p>
      {description && <p className="text-xs text-content-muted mb-4">{description}</p>}
      {action}
    </div>
  );
}
