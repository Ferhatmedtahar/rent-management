import type { Metadata } from "next";
import { LoginScreenContainer } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Rent Collection account",
};

export default function LoginPage() {
  return <LoginScreenContainer />;
}
