import Link from "next/link";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type LoadingStateProps = {
  className?: string;
  label?: string;
  rows?: number;
};

/**
 * Standard loading state: accessible Skeleton layout with role="status" and aria-busy.
 */
export function LoadingState({
  className,
  label = "Loading...",
  rows = 4,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("w-full space-y-4 p-6", className)}
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-3 pt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Standard error banner with role="alert" in red-soft styling and a retry CTA.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-card border-outline bg-red-soft text-label flex flex-col items-start gap-3 border p-5",
        className,
      )}
    >
      <div className="text-red flex items-center gap-2.5 font-medium">
        <AlertCircleIcon className="size-5 shrink-0" aria-hidden="true" />
        <h3 className="text-headline">{title}</h3>
      </div>
      <p className="text-body text-label-2">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-outline bg-card hover:bg-card-hover mt-1"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
};

/**
 * Standard empty state card with icon, explanation, and clear primary CTA.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-card border-outline bg-card flex flex-col items-center justify-center border p-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-fill-3 text-label-2 mb-3 flex size-12 items-center justify-center rounded-xl">
          {icon}
        </div>
      )}
      <h3 className="text-title-2 text-label font-semibold">{title}</h3>
      <p className="text-subheadline text-label-2 mt-1.5 max-w-sm">
        {description}
      </p>
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Button
              asChild
              className="bg-tint-fill text-on-tint hover:opacity-90"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button
              onClick={action.onClick}
              className="bg-tint-fill text-on-tint hover:opacity-90"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
