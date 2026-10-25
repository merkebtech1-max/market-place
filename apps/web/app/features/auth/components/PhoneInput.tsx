import { Input } from "@/components/ui/Input";

export function normalizeEthiopianPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^0[79]\d{8}$/.test(compact)) return `+251${compact.slice(1)}`;
  if (/^[79]\d{8}$/.test(compact)) return `+251${compact}`;
  return compact;
}

function localMobileDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("251")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 9);
}

export function PhoneInput({
  value,
  onChange,
  label,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
}) {
  return (
    <Input
      label={label}
      error={error}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      prefix="+251"
      placeholder="9XX XXX XXX or 7XX XXX XXX"
      pattern="[79][0-9]{8}"
      maxLength={9}
      value={value}
      onChange={(event) => onChange(localMobileDigits(event.target.value))}
      required
    />
  );
}
