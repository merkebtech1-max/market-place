import type { Metadata } from "next";
import { AuthForm, type AuthMode } from "@/features/auth/components/AuthForm";

export const metadata: Metadata = { title: "Sign in — Merkeb Market" };

type SignInPageProps = {
  searchParams: Promise<{ mode?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { mode, next } = await searchParams;
  const initialMode: AuthMode = mode === "signup" ? "signup" : "login";
  const returnTo = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return <AuthForm initialMode={initialMode} returnTo={returnTo} />;
}
