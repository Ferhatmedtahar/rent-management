"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useMe } from "@/modules/auth";
import { Logo } from "@/shared/components/logo";
import { StatusBadge } from "@/shared/components/status-badge";
import { LoadingState, ErrorState } from "@/shared/components/page-state";
import { Button } from "@/shared/ui/button";
import { createClient } from "@/shared/supabase/browser";

type TenantShellProps = {
  children: React.ReactNode;
};

export function TenantShell({ children }: TenantShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading, isError, refetch } = useMe();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !me) {
      router.replace("/login");
      return;
    }
    // Staff/manager accessing tenant portal is redirected to dashboard
    if (me.role !== "tenant") {
      router.replace("/dashboard");
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
        <LoadingState label="Loading tenant portal..." />
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

  if (me.role !== "tenant") {
    return (
      <div className="container-max py-8">
        <LoadingState label="Redirecting to dashboard..." />
      </div>
    );
  }

  return (
    <div className="bg-bg flex min-h-screen flex-col">
      <header className="border-outline bg-card/90 sticky top-0 z-40 w-full border-b backdrop-blur-md">
        <div className="container-max flex h-16 items-center justify-between">
          <Link href="/portal" className="transition-opacity hover:opacity-90">
            <Logo />
          </Link>

          <div className="flex items-center gap-3">
            <StatusBadge
              status="success"
              label="Tenant"
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
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
