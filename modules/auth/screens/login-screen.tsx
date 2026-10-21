import type { UseFormReturn } from "react-hook-form";
import { Loader2Icon } from "lucide-react";
import { Logo } from "@/shared/components/logo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { LoginInput } from "../schemas/login.schema";

export type LoginScreenProps = {
  form: UseFormReturn<LoginInput>;
  onSubmit: (data: LoginInput) => void;
  isSubmitting: boolean;
  serverError: string | null;
};

/**
 * PURE view for the sign-in screen.
 * Props in, markup out: no fetching, no state, no browser storage access.
 */
export function LoginScreen({
  form,
  onSubmit,
  isSubmitting,
  serverError,
}: LoginScreenProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full items-center justify-center p-4">
      <div className="rounded-card border-outline bg-card w-full max-w-[420px] border p-6 shadow-xs sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-4" />
          <h1 className="text-large-title text-label font-bold tracking-tight">
            Sign in
          </h1>
          <p className="text-subheadline text-label-2 mt-1">
            Enter your email and password to access your account
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="border-red-soft bg-red-soft text-footnote text-red mb-5 rounded-lg border p-3 font-medium"
          >
            {serverError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="login-email"
              className="text-subheadline text-label font-medium"
            >
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@domain.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              disabled={isSubmitting}
              className="bg-inset border-outline"
              {...register("email")}
            />
            {errors.email?.message && (
              <p id="email-error" className="text-footnote text-red">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="login-password"
              className="text-subheadline text-label font-medium"
            >
              Password
            </Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              disabled={isSubmitting}
              className="bg-inset border-outline"
              {...register("password")}
            />
            {errors.password?.message && (
              <p id="password-error" className="text-footnote text-red">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-tint-fill text-on-tint w-full font-medium hover:opacity-90"
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Signing in...</span>
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
