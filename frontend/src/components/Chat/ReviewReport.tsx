import type { ReviewResult } from "../../types";
import { Badge } from "../ui/Badge";
import { Star, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  review: ReviewResult;
}

export function ReviewReport({ review }: Props) {
  const gradeConfig: Record<string, { icon: typeof Star; variant: "success" | "brand" | "warning" | "error"; label: string }> = {
    A: { icon: Star, variant: "success", label: "优秀" },
    B: { icon: CheckCircle, variant: "brand", label: "良好" },
    C: { icon: AlertTriangle, variant: "warning", label: "需改进" },
    D: { icon: XCircle, variant: "error", label: "不合格" },
  };

  const config = gradeConfig[review.grade] || gradeConfig.B;
  const Icon = config.icon;

  return (
    <div className="mt-2 border border-border rounded-lg p-3 bg-surface-muted">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={`text-${config.variant === "success" ? "green" : config.variant === "brand" ? "blue" : config.variant === "warning" ? "yellow" : "red"}-400`} />
        <Badge variant={config.variant}>
          质量审核: {review.grade}级 - {config.label}
        </Badge>
      </div>
      <p className="text-sm text-content-secondary mb-1">{review.summary}</p>
      {review.details && (
        <p className="text-xs text-content-muted whitespace-pre-wrap">{review.details}</p>
      )}
    </div>
  );
}
