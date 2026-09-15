import { Input } from "@/components/ui/Input";

export function normalizeEthiopianPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{8}$/.test(compact)) return `+251${compact.slice(1)}`;
  if (/^9\d{8}$/.test(compact)) return `+251${compact}`;
  return compact;
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
      placeholder="+251 9XX XXX XXX"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
    />
  );
}
