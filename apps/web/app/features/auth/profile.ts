"use client";

import { useEffect, useState } from "react";
import { authenticatedApiRequest } from "@/lib/auth";

export interface AccountProfile {
  id: string;
  phone: string;
  displayName: string;
  avatarKey: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

export async function getAccountProfile() {
  const response = await authenticatedApiRequest<{ success: true; data: AccountProfile }>(
    "/auth/me",
    { cache: "no-store" }
  );
  return response.data;
}

export function useAccountProfile(isAuthenticated: boolean) {
  const [profile, setProfile] = useState<AccountProfile>();

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getAccountProfile()
      .then((next) => { if (!cancelled) setProfile(next); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return isAuthenticated ? profile : undefined;
}
