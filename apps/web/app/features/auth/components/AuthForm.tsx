"use client";

import Image from "next/image";
import { LoginForm } from "./LoginForm";

export type AuthMode = "login" | "signup";

/** Lidia's responsive auth presentation wrapped around the real phone/OTP flow. */
export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const backgroundImage =
    initialMode === "signup" ? "/image/auth-signup.png" : "/image/auth-login.png";

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <Image
        src={backgroundImage}
        alt=""
        fill
        priority
        quality={100}
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-linear-to-b from-ink/75 via-primary/55 to-ink/85"
        aria-hidden
      />
      <div className="relative z-20 flex min-h-dvh items-center justify-center px-4 py-8 sm:px-10">
        <LoginForm />
      </div>
    </div>
  );
}
