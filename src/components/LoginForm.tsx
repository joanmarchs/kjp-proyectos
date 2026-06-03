"use client";

import { LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";
import { use, useState } from "react";

export default function LoginForm({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = use(searchParams);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.error === "config" ? "Falta configurar LOGIN_PASSWORD, AUTH_TOKEN y AUTH_ALLOWED_EMAILS en Vercel." : ""
  );
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo iniciar sesión.");
      return;
    }

    window.location.href = params.next || "/";
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon">
          <LockKeyhole size={24} />
        </div>
        <p className="eyebrow">KJP</p>
        <h1>Acceso privado</h1>
        <label>
          <span>Email</span>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
          />
        </label>
        <label>
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Introduce la contraseña"
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
