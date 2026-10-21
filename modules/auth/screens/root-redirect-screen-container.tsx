"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/shared/components/page-state";
import { useMe } from "../hooks/use-me";

export function RootRedirectScreenContainer() {
  const router = useRouter();
  const { data: me, isLoading, isError } = useMe();

  useEffect(() => {
    if (isLoading) return;

    if (isError || !me) {
      router.replace("/login");
      return;
    }

    if (me.role === "tenant") {
      router.replace("/portal");
    } else {
      router.replace("/dashboard");
    }
  }, [me, isLoading, isError, router]);

  return <LoadingState label="Redirecting..." />;
}
