"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/supabase/browser";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchMe } from "../services/auth-api.service";
import { loginSchema, type LoginInput } from "../schemas/login.schema";
import { LoginScreen } from "./login-screen";

export function LoginScreenContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      setServerError("Incorrect email or password");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.me.all });

    try {
      const me = await fetchMe();
      if (me.role === "tenant") {
        router.replace("/portal");
      } else {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/dashboard");
    }
  };

  return (
    <LoginScreen
      form={form}
      onSubmit={onSubmit}
      isSubmitting={form.formState.isSubmitting}
      serverError={serverError}
    />
  );
}
