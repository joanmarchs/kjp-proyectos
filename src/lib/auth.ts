import { cookies } from "next/headers";

export const AUTH_COOKIE = "kjp_session";

export async function isAuthenticated() {
  const token = process.env.AUTH_TOKEN;
  if (!token) return false;
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value === token;
}
