"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PinInput } from "@/components/ui/PinInput";
import { saveSession } from "@/features/auth/session";
import { useTranslations } from "@/il8n/LanguageProvider";

export type AuthMode = "login" | "signup" | "forgot";
type SignupStep = "phone" | "otp" | "details";

const PIN_PATTERN = /^\d{6}$/;
const OTP_PATTERN = /^\d{4}$/;

// Create account gets its own photo so the two screens read as distinct steps.
const BACKGROUND_IMAGE: Record<AuthMode, string> = {
  login: "/image/auth-login.png",
  forgot: "/image/auth-login.png",
  signup: "/image/auth-signup.png",
};

/**
 * Login: name + 6-digit PIN, with Create account and Forgot password.
 * Create account is a 3-step wizard: phone number -> OTP verification ->
 * name + 6-digit PIN + confirm, then on to the marketplace.
 */
export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode === "forgot" ? "login" : initialMode);
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [phone, setPhone] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const t = useTranslations();

  function resetErrors() {
    setConfirmError(null);
    setPinError(null);
    setOtpError(null);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setSignupStep("phone");
    setPhone("");
    resetErrors();
    setForgotSent(false);
    setSubmitting(false);
  }

  function handleBack() {
    if (mode === "signup" && signupStep === "otp") {
      resetErrors();
      setSignupStep("phone");
      return;
    }
    if (mode === "signup" && signupStep === "details") {
      resetErrors();
      setSignupStep("otp");
      return;
    }
    switchMode("login");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    resetErrors();

    const data = new FormData(e.currentTarget);

    if (mode === "forgot") {
      setForgotSent(true);
      return;
    }

    if (mode === "signup") {
      if (signupStep === "phone") {
        const raw = String(data.get("phone") ?? "").replace(/\D/g, "").replace(/^0/, "").replace(/^251/, "");
        setPhone(`+251${raw}`);
        setSignupStep("otp");
        return;
      }

      if (signupStep === "otp") {
        const otp = String(data.get("otp") ?? "");
        if (!OTP_PATTERN.test(otp)) {
          setOtpError(t("auth.otpInvalid"));
          return;
        }
        setSignupStep("details");
        return;
      }

      const name = String(data.get("name") ?? "").trim();
      const pin = String(data.get("pin") ?? "");
      const confirmPin = String(data.get("confirmPin") ?? "");
      if (!PIN_PATTERN.test(pin)) {
        setPinError(t("auth.pinInvalid"));
        return;
      }
      if (pin !== confirmPin) {
        setConfirmError(t("auth.pinMismatch"));
        return;
      }
      setSubmitting(true);
      saveSession({ name, phone });
      router.push("/home");
      return;
    }

    // login
    const name = String(data.get("name") ?? "").trim();
    const pin = String(data.get("pin") ?? "");
    if (!PIN_PATTERN.test(pin)) {
      setPinError(t("auth.pinInvalid"));
      return;
    }
    setSubmitting(true);
    saveSession({ name });
    router.push("/home");
  }

  const title =
    mode === "forgot" ? t("auth.forgotPassword") : mode === "login" ? t("auth.loginTab") : t("auth.signupTab");

  const stepBody =
    mode === "signup" && signupStep === "phone"
      ? t("auth.phoneStepBody")
      : mode === "signup" && signupStep === "otp"
        ? t("auth.otpStepBody", { phone })
        : null;

  const formKey = `${mode}-${signupStep}`;

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <Image
        key={BACKGROUND_IMAGE[mode]}
        src={BACKGROUND_IMAGE[mode]}
        alt=""
        fill
        priority
        quality={100}
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-linear-to-b from-ink/75 via-primary/55 to-ink/85" aria-hidden />

      <div className="relative z-20 flex min-h-dvh items-center justify-center px-4 py-8 sm:px-10">
        <div className="w-full max-w-sm rounded-card bg-surface p-5 shadow-elevation-2 sm:p-6">
          <h1 className="text-center text-xl font-semibold text-ink">{title}</h1>
          {stepBody && <p className="mt-1.5 text-center text-sm text-ink-muted">{stepBody}</p>}

          <form key={formKey} onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            {mode === "login" && (
              <>
                <Input
                  name="name"
                  label={t("auth.name")}
                  placeholder={t("auth.namePlaceholder")}
                  autoComplete="name"
                  required
                />
                <PinInput name="pin" length={6} label={t("auth.pin")} error={pinError ?? undefined} />
              </>
            )}

            {mode === "forgot" && (
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                label={t("auth.phone")}
                placeholder="9xxxxxxxx"
                prefix="+251"
                autoComplete="tel"
                required
              />
            )}

            {mode === "signup" && signupStep === "phone" && (
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                label={t("auth.phone")}
                placeholder="9xxxxxxxx"
                prefix="+251"
                autoComplete="tel"
                defaultValue={phone.replace(/^\+251/, "")}
                required
              />
            )}

            {mode === "signup" && signupStep === "otp" && (
              <PinInput name="otp" length={4} label={t("auth.otp")} error={otpError ?? undefined} autoFocus />
            )}

            {mode === "signup" && signupStep === "details" && (
              <>
                <Input
                  name="name"
                  label={t("auth.name")}
                  placeholder={t("auth.namePlaceholder")}
                  autoComplete="name"
                  required
                />
                <PinInput name="pin" length={6} label={t("auth.pin")} error={pinError ?? undefined} />
                <PinInput name="confirmPin" length={6} label={t("auth.confirmPin")} error={confirmError ?? undefined} />
              </>
            )}

            {mode === "forgot" && forgotSent ? (
              <p className="text-sm text-ink-muted">{t("auth.forgotSent")}</p>
            ) : (
              <Button type="submit" size="lg" fullWidth loading={submitting}>
                {mode === "login"
                  ? t("auth.loginCta")
                  : mode === "forgot"
                    ? t("auth.forgotSubmit")
                    : signupStep === "phone"
                      ? t("auth.sendOtp")
                      : signupStep === "otp"
                        ? t("auth.verifyOtp")
                        : t("auth.createAccountCta")}
              </Button>
            )}
          </form>

          {mode === "login" ? (
            <div className="mt-4 flex flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                className="flex-1 whitespace-normal px-2 text-xs sm:text-sm"
                onClick={() => switchMode("signup")}
              >
                {t("home.createAccount")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="flex-1 whitespace-normal px-2 text-xs sm:text-sm"
                onClick={() => switchMode("forgot")}
              >
                {t("auth.forgotPassword")}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="md" fullWidth className="mt-4" onClick={handleBack}>
              {mode === "signup" && signupStep !== "phone" ? t("common.back") : t("auth.backToLogin")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
