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
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.error === "config" ? "Falta configurar LOGIN_PASSWORD y AUTH_TOKEN en Vercel." : "");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
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
          <span>Contraseña</span>
          <input
            autoFocus
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
