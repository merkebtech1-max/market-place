import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function OtpForm({
  code,
  onCodeChange,
  onSubmit,
  onBack,
  onResend,
  loading,
  secondsUntilResend,
  labels,
}: {
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onResend: () => void;
  loading: boolean;
  secondsUntilResend: number;
  labels: {
    code: string;
    verify: string;
    back: string;
    resend: string;
    resendIn: string;
  };
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label={labels.code}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ""))}
        required
      />
      <Button type="submit" fullWidth loading={loading} disabled={code.length < 4}>
        {labels.verify}
      </Button>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          {labels.back}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResend}
          disabled={loading || secondsUntilResend > 0}
        >
          {secondsUntilResend > 0
            ? labels.resendIn.replace("{seconds}", String(secondsUntilResend))
            : labels.resend}
        </Button>
      </div>
    </form>
  );
}
