import type { Metadata } from "next";
import { AuthForm, type AuthMode } from "@/features/auth/components/AuthForm";

export const metadata: Metadata = { title: "Sign in — Merkeb Market" };

type SignInPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { mode } = await searchParams;
  const initialMode: AuthMode = mode === "signup" ? "signup" : "login";

  return <AuthForm initialMode={initialMode} />;
}
