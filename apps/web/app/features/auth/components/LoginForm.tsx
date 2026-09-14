"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useTranslations } from "@/il8n/LanguageProvider";
import { ApiError } from "@/lib/api";
import { saveAuthSession } from "@/lib/auth";
import { loginWithOtp, registerWithOtp, requestOtp } from "../actions";
import { OtpForm } from "./OtpForm";
import { normalizeEthiopianPhone, PhoneInput } from "./PhoneInput";

type Step = "phone" | "otp" | "register";

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  useEffect(() => {
    if (secondsUntilResend <= 0) return;
    const timer = window.setInterval(
      () => setSecondsUntilResend((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [secondsUntilResend]);

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedPhone = normalizeEthiopianPhone(phoneInput);
    if (!/^\+2519\d{8}$/.test(normalizedPhone)) {
      setError(t("auth.invalidPhone"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await requestOtp(normalizedPhone);
      setPhone(normalizedPhone);
      setCode("");
      setStep("otp");
      setSecondsUntilResend(60);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await loginWithOtp(phone, code);
      saveAuthSession(response);
      router.push("/dashboard");
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.status === 404) {
        setStep("register");
      } else {
        setError(loginError instanceof Error ? loginError.message : t("auth.genericError"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await registerWithOtp(phone, code, displayName.trim());
      saveAuthSession(response);
      router.push("/dashboard");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardBody className="space-y-5 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("auth.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {step === "phone" ? t("auth.phoneHelp") : t("auth.codeSent").replace("{phone}", phone)}
          </p>
        </div>

        {error && <p role="alert" className="rounded-control bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        {step === "phone" && (
          <form onSubmit={sendCode} className="space-y-4">
            <PhoneInput value={phoneInput} onChange={setPhoneInput} label={t("auth.phone")} />
            <Button type="submit" fullWidth loading={loading}>{t("auth.sendCode")}</Button>
          </form>
        )}

        {step === "otp" && (
          <OtpForm
            code={code}
            onCodeChange={setCode}
            onSubmit={verifyCode}
            onBack={() => { setStep("phone"); setError(""); }}
            onResend={() => void sendCode()}
            loading={loading}
            secondsUntilResend={secondsUntilResend}
            labels={{
              code: t("auth.code"),
              verify: t("auth.verify"),
              back: t("auth.changePhone"),
              resend: t("auth.resend"),
              resendIn: t("auth.resendIn"),
            }}
          />
        )}

        {step === "register" && (
          <form onSubmit={register} className="space-y-4">
            <p className="text-sm text-ink-muted">{t("auth.newAccount")}</p>
            <Input
              label={t("auth.displayName")}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              required
            />
            <Button type="submit" fullWidth loading={loading} disabled={displayName.trim().length < 2}>
              {t("auth.createAccount")}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
