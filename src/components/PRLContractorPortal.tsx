"use client";

import { FileUp, LogIn, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Invitation = {
  company_name: string;
  company_email: string;
  contact_name: string | null;
  project_name: string;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  expiry_date: string | null;
  signed_url?: string | null;
};

const statusText: Record<string, string> = {
  revision: "En revision",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  caducado: "Caducado",
  pendiente: "Pendiente"
};

export default function PRLContractorPortal({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authContact, setAuthContact] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/prl/access/${token}`);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cargar la invitacion.");
      return;
    }

    setInvitation(payload.invitation);
    setAuthenticated(Boolean(payload.authenticated));
    setAuthEmail(payload.invitation?.company_email ?? "");
    setAuthContact(payload.invitation?.contact_name ?? "");
    setDocuments(payload.documents ?? []);
    setRequiredDocuments(payload.requiredDocuments ?? []);
    setDocumentType(payload.requiredDocuments?.[0] ?? "");
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la invitacion.");
    });
  }, [token]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage("");
    const response = await fetch(`/api/prl/access/${token}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: authMode, email: authEmail, password: authPassword, contactName: authContact })
    });
    const payload = await response.json();
    setAuthLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo acceder.");
      return;
    }

    setAuthPassword("");
    setMessage(authMode === "register" ? "Acceso creado correctamente." : "Sesion iniciada correctamente.");
    await load();
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Adjunta un archivo.");
      return;
    }

    setUploading(true);
    setMessage("");
    const form = new FormData();
    form.set("documentType", documentType);
    form.set("issueDate", issueDate);
    form.set("expiryDate", expiryDate);
    form.set("file", file);

    const response = await fetch(`/api/prl/access/${token}/documents`, { method: "POST", body: form });
    const payload = await response.json();
    setUploading(false);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo subir el documento.");
      return;
    }

    setFile(null);
    setIssueDate("");
    setExpiryDate("");
    setMessage("Documento subido. Queda en revision por KJP.");
    await load();
  }

  if (loading) return <main className="contractor-prl"><div className="prl-empty">Cargando acceso PRL...</div></main>;

  return (
    <main className="contractor-prl">
      <section className="contractor-card">
        <p className="eyebrow clean">Acceso PRL / CAE</p>
        <h1>{invitation?.project_name ?? "Invitacion PRL"}</h1>
        {invitation ? <p>{invitation.company_name} · {invitation.company_email}</p> : null}
        {message ? <div className="notice">{message}</div> : null}

        {!authenticated ? (
          <div className="contractor-auth">
            <div className="contractor-auth-switch">
              <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")} type="button">
                <UserPlus size={16} />
                Crear acceso
              </button>
              <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")} type="button">
                <LogIn size={16} />
                Ya tengo cuenta
              </button>
            </div>
            <form className="contractor-upload" onSubmit={authenticate}>
              <label>
                Email
                <input type="email" value={authEmail} readOnly />
              </label>
              {authMode === "register" ? (
                <label>
                  Contacto
                  <input value={authContact} onChange={(event) => setAuthContact(event.target.value)} placeholder="Nombre de contacto" />
                </label>
              ) : null}
              <label>
                Contraseña
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder={authMode === "register" ? "Crea una contraseña" : "Introduce tu contraseña"}
                />
              </label>
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Comprobando" : authMode === "register" ? "Registrarme y entrar" : "Entrar"}
              </button>
            </form>
          </div>
        ) : (
          <>
            <form className="contractor-upload" onSubmit={upload}>
              <label>
                Tipo documento
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  {requiredDocuments.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Fecha emision
                <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </label>
              <label>
                Fecha caducidad
                <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
              </label>
              <label>
                Archivo
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" disabled={uploading}>
                <FileUp size={16} />
                {uploading ? "Subiendo" : "Subir documento"}
              </button>
            </form>

            <h2>Documentos enviados</h2>
            <div className="contractor-docs">
              {documents.length === 0 ? <div className="prl-empty">Todavia no hay documentos subidos.</div> : null}
              {documents.map((document) => (
                <article key={document.id}>
                  <strong>{document.document_type}</strong>
                  <span>{document.file_name}</span>
                  <span className={`prl-badge ${document.status}`}>{statusText[document.status] ?? document.status}</span>
                  {document.signed_url ? <a href={document.signed_url} target="_blank">Ver archivo</a> : null}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
