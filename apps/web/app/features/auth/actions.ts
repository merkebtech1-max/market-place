import { apiRequest } from "@/lib/api";
import type { AuthResponse, OtpResponse } from "./types";

export function requestOtp(phone: string) {
  return apiRequest<OtpResponse>("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function loginWithOtp(phone: string, code: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function registerWithOtp(phone: string, code: string, displayName: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone, code, displayName }),
  });
}

export function refreshTokens(refreshToken: string) {
  return apiRequest<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(accessToken: string) {
  return apiRequest<{ success: true; message: string }>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
