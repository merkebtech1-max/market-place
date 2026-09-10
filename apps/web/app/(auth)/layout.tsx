import { AuthBrandBar } from "@/components/layout/AuthBrandBar";

/** Sign-in / create-account: brand bar only, no marketplace chrome. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="pointer-events-auto">
          <AuthBrandBar />
        </div>
      </div>
      <main className="relative z-10 flex min-h-dvh flex-1 flex-col">{children}</main>
    </div>
  );
}
