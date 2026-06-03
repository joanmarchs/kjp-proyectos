import { cookies } from "next/headers";

export const AUTH_COOKIE = "kjp_session";

export function allowedEmails() {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function buildSessionValue(email: string) {
  return `${process.env.AUTH_TOKEN}:${email.toLowerCase()}`;
}

export async function isAuthenticated() {
  const token = process.env.AUTH_TOKEN;
  if (!token) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_COOKIE)?.value ?? "";
  const email = session.startsWith(`${token}:`) ? session.slice(token.length + 1).toLowerCase() : "";
  return Boolean(email && allowedEmails().includes(email));
}
