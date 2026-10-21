"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useMe } from "@/modules/auth";
import { Logo } from "@/shared/components/logo";
import { StatusBadge } from "@/shared/components/status-badge";
import { LoadingState, ErrorState } from "@/shared/components/page-state";
import { Button } from "@/shared/ui/button";
import { createClient } from "@/shared/supabase/browser";
import { cn } from "@/shared/lib/utils";

type StaffShellProps = {
  children: React.ReactNode;
};

export function StaffShell({ children }: StaffShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError, refetch } = useMe();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !me) {
      router.replace("/login");
      return;
    }
    // A tenant accessing staff routes is redirected to portal
    if (me.role === "tenant") {
      router.replace("/portal");
    }
  }, [me, isLoading, isError, router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace("/login");
  };

  if (isLoading) {
    return (
      <div className="container-max py-8">
        <LoadingState label="Loading staff portal..." />
      </div>
    );
  }

  if (isError || !me) {
    return (
      <div className="container-max py-8">
        <ErrorState
          title="Authentication error"
          message="Could not verify your credentials. Please sign in again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (me.role === "tenant") {
    return (
      <div className="container-max py-8">
        <LoadingState label="Redirecting to tenant portal..." />
      </div>
    );
  }

  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isLeases = pathname === "/leases" || pathname.startsWith("/leases/");

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      <header className="border-outline bg-card/90 sticky top-0 z-40 w-full border-b backdrop-blur-md">
        <div className="container-max flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="transition-opacity hover:opacity-90"
            >
              <Logo />
            </Link>

            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Main Navigation"
            >
              <Link
                href="/dashboard"
                className={cn(
                  "text-headline rounded-md px-3 py-1.5 transition-colors",
                  isDashboard
                    ? "text-tint font-semibold"
                    : "text-label-2 hover:bg-fill-4 hover:text-label",
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/leases"
                className={cn(
                  "text-headline rounded-md px-3 py-1.5 transition-colors",
                  isLeases
                    ? "text-tint font-semibold"
                    : "text-label-2 hover:bg-fill-4 hover:text-label",
                )}
              >
                Leases
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge
              status="success"
              label={me.role === "manager" ? "Manager" : "Staff"}
              showIcon={false}
              className="bg-fill-3 text-label"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-footnote text-label-2 hover:bg-fill-4 hover:text-label gap-1.5"
              aria-label="Sign out"
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <nav
          className="border-outline/50 flex border-t px-4 py-2 md:hidden"
          aria-label="Mobile Navigation"
        >
          <div className="flex w-full items-center justify-around">
            <Link
              href="/dashboard"
              className={cn(
                "text-headline rounded-md px-3 py-1 transition-colors",
                isDashboard
                  ? "text-tint font-semibold"
                  : "text-label-2 hover:text-label",
              )}
            >
              Dashboard
            </Link>
            <Link
              href="/leases"
              className={cn(
                "text-headline rounded-md px-3 py-1 transition-colors",
                isLeases
                  ? "text-tint font-semibold"
                  : "text-label-2 hover:text-label",
              )}
            >
              Leases
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
