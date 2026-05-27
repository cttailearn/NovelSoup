import { Loader2 } from "lucide-react";

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <Loader2 size={24} className="text-brand-600 dark:text-brand-400 animate-spin mb-4" />
      <div className="space-y-2 w-full max-w-md">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-surface-hover rounded animate-pulse"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-5 bg-surface-elevated border border-border rounded-xl animate-pulse">
      <div className="h-5 bg-surface-hover rounded w-1/3 mb-3" />
      <div className="h-4 bg-surface-hover rounded w-2/3 mb-2" />
      <div className="flex gap-2">
        <div className="h-4 bg-surface-hover rounded w-16" />
        <div className="h-4 bg-surface-hover rounded w-24" />
      </div>
    </div>
  );
}

export function ChapterListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-9 bg-surface-hover rounded-md animate-pulse" />
      ))}
    </div>
  );
}
