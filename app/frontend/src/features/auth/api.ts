import { request } from "../../lib/transport";

export type Account = { id: number; email: string; name: string };
export type AuthStatus = { enabled: boolean };
export type AuthResult = { user: Account };
export type AuthMessage = { message: string };

export const authApi = {
  status: () => request<AuthStatus>("/auth/status"),
  me: () => request<AuthResult>("/auth/me"),
  register: (name: string, email: string, password: string) =>
    request<AuthMessage>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }),
  verify: (token: string) =>
    request<AuthResult>("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  login: (email: string, password: string) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<AuthMessage>("/auth/logout", { method: "POST" }),
  forgot: (email: string) =>
    request<AuthMessage>("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  resendVerification: (email: string) =>
    request<AuthMessage>("/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  reset: (token: string, password: string) =>
    request<AuthMessage>("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }),
  changePassword: (current_password: string, new_password: string) =>
    request<AuthMessage>("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password, new_password }),
    }),
};
