"use client";

import { FileUp } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Invitation = {
  company_name: string;
  company_email: string;
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
  revision: "En revisión",
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

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/prl/access/${token}`);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cargar la invitación.");
      return;
    }

    setInvitation(payload.invitation);
    setDocuments(payload.documents ?? []);
    setRequiredDocuments(payload.requiredDocuments ?? []);
    setDocumentType(payload.requiredDocuments?.[0] ?? "");
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la invitación.");
    });
  }, [token]);

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
    setMessage("Documento subido. Queda en revisión por KJP.");
    await load();
  }

  if (loading) return <main className="contractor-prl"><div className="prl-empty">Cargando acceso PRL...</div></main>;

  return (
    <main className="contractor-prl">
      <section className="contractor-card">
        <p className="eyebrow clean">Acceso PRL / CAE</p>
        <h1>{invitation?.project_name ?? "Invitación PRL"}</h1>
        {invitation ? <p>{invitation.company_name} · {invitation.company_email}</p> : null}
        {message ? <div className="notice">{message}</div> : null}

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
            Fecha emisión
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
          {documents.length === 0 ? <div className="prl-empty">Todavía no hay documentos subidos.</div> : null}
          {documents.map((document) => (
            <article key={document.id}>
              <strong>{document.document_type}</strong>
              <span>{document.file_name}</span>
              <span className={`prl-badge ${document.status}`}>{statusText[document.status] ?? document.status}</span>
              {document.signed_url ? <a href={document.signed_url} target="_blank">Ver archivo</a> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
