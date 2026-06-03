import { NextResponse } from "next/server";
import { allowedEmails, AUTH_COOKIE, buildSessionValue } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  const expectedPassword = process.env.LOGIN_PASSWORD;
  const authToken = process.env.AUTH_TOKEN;
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  if (!expectedPassword || !authToken || allowedEmails().length === 0) {
    return NextResponse.json({ error: "Login no configurado en el servidor." }, { status: 500 });
  }

  if (!allowedEmails().includes(normalizedEmail)) {
    return NextResponse.json({ error: "Este email no tiene acceso autorizado." }, { status: 403 });
  }

  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, buildSessionValue(normalizedEmail), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
