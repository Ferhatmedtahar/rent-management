import { cn } from "@/shared/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

/**
 * Small inline SVG mark (rounded square in tint-fill containing a house glyph in on-tint)
 * next to the wordmark "Rent Collection" in text-headline.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div
        className="bg-tint-fill text-on-tint flex size-8 shrink-0 items-center justify-center rounded-lg"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4.5"
        >
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        </svg>
      </div>
      {showWordmark && (
        <span className="text-headline text-label tracking-tight">
          Rent Collection
        </span>
      )}
    </div>
  );
}
