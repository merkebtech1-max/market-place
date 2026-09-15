export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  success: true;
  message: string;
  userId: string;
  tokens: AuthTokens;
}

export interface OtpResponse {
  success: true;
  message: string;
}
