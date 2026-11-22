import { apiRequest } from "./base";

export type SignInMethod = {
  id: string;
  name: string;
  linked: boolean;
};

export type AccountSecurity = {
  first_name: string;
  last_name: string;
  email: string;
  has_password: boolean;
  mfa_enabled: boolean;
  sign_in_methods: SignInMethod[];
};

export type MfaEnrollment = {
  otpauth_url: string;
  qr_image: string;
  secret: string;
};

export const accountApi = {
  security: () => apiRequest<AccountSecurity>("/api/user/me/security"),
  setPassword: (password: string) =>
    apiRequest<{ message: string }>("/api/user/me/password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  setupMfa: () =>
    apiRequest<MfaEnrollment>("/api/user/me/mfa/setup", { method: "POST" }),
  confirmMfa: (code: string) =>
    apiRequest<{ message: string }>("/api/user/me/mfa/confirm", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  disableMfa: (password: string) =>
    apiRequest<{ message: string }>("/api/user/me/mfa/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};
