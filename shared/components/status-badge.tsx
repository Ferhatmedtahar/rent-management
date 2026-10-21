import {
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

export type StatusType =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "overdue"
  | "approved"
  | "pending_verification"
  | "rejected"
  | "voided"
  | "pending"
  | "success"
  | "failed"
  | "void";

type StatusConfig = {
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  paid: {
    label: "Paid",
    className: "bg-green-soft text-green border-transparent",
    icon: CheckCircle2Icon,
  },
  approved: {
    label: "Approved",
    className: "bg-green-soft text-green border-transparent",
    icon: CheckCircle2Icon,
  },
  success: {
    label: "Success",
    className: "bg-green-soft text-green border-transparent",
    icon: CheckCircle2Icon,
  },
  partially_paid: {
    label: "Partially paid",
    className: "bg-orange-soft text-orange border-transparent",
    icon: ClockIcon,
  },
  pending_verification: {
    label: "Pending verification",
    className: "bg-orange-soft text-orange border-transparent",
    icon: ClockIcon,
  },
  pending: {
    label: "Pending",
    className: "bg-orange-soft text-orange border-transparent",
    icon: ClockIcon,
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-soft text-red border-transparent",
    icon: AlertTriangleIcon,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-soft text-red border-transparent",
    icon: XCircleIcon,
  },
  failed: {
    label: "Failed",
    className: "bg-red-soft text-red border-transparent",
    icon: XCircleIcon,
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-gray-soft text-gray border-transparent",
    icon: MinusCircleIcon,
  },
  voided: {
    label: "Voided",
    className: "bg-gray-soft text-gray border-transparent",
    icon: MinusCircleIcon,
  },
  void: {
    label: "Void",
    className: "bg-gray-soft text-gray border-transparent",
    icon: MinusCircleIcon,
  },
};

type StatusBadgeProps = {
  status: StatusType | string;
  label?: string;
  className?: string;
  showIcon?: boolean;
};

/**
 * Status badge with soft background + colored label + icon.
 * Never relies on color alone to convey meaning (WCAG AA).
 */
export function StatusBadge({
  status,
  label,
  className,
  showIcon = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusType] ?? {
    label: status,
    className: "bg-gray-soft text-gray border-transparent",
    icon: MinusCircleIcon,
  };

  const IconComponent = config.icon;
  const displayText = label ?? config.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-caption inline-flex items-center gap-1.5 px-2.5 py-0.5 font-medium tracking-normal shadow-none",
        config.className,
        className,
      )}
    >
      {showIcon && (
        <IconComponent className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{displayText}</span>
    </Badge>
  );
}
