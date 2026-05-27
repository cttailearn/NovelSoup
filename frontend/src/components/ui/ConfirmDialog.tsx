import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "确认删除",
  loading = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} width="sm">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-error-bg flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-error" />
        </div>
        <h3 className="text-base font-semibold text-content-primary mb-2">{title}</h3>
        <p className="text-sm text-content-secondary mb-6">{message}</p>
        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "删除中..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
