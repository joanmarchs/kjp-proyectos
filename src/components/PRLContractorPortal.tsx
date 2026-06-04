"use client";

import { FileUp, LogIn, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type ContractorType = "empresa" | "autonomo";
type OwnerType = "company" | "worker";

type Invitation = {
  company_name: string;
  company_email: string;
  company_cif: string | null;
  contact_name: string | null;
  project_name: string;
};

type Contractor = {
  id: string;
  email: string;
  contractor_type: ContractorType;
  company_name: string;
  company_cif: string | null;
  contact_name: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  dni: string | null;
  position: string | null;
};

type DocumentRow = {
  id: string;
  document_type: string;
  owner_type: OwnerType | null;
  owner_id: string | null;
  owner_name: string | null;
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

function latestDocument(documents: DocumentRow[], ownerType: OwnerType, documentType: string, ownerId?: string) {
  return documents.find(
    (document) =>
      (document.owner_type ?? "company") === ownerType &&
      document.document_type === documentType &&
      (ownerType === "company" || document.owner_id === ownerId)
  );
}

function statusClass(status: string) {
  if (status === "aprobado") return "aprobado";
  if (status === "rechazado" || status === "caducado") return "rechazado";
  return "revision";
}

export default function PRLContractorPortal({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requiredCompanyDocuments, setRequiredCompanyDocuments] = useState<string[]>([]);
  const [requiredWorkerDocuments, setRequiredWorkerDocuments] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("company");
  const [workerId, setWorkerId] = useState("");
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
  const [profileType, setProfileType] = useState<ContractorType>("empresa");
  const [profileName, setProfileName] = useState("");
  const [profileCif, setProfileCif] = useState("");
  const [profileContact, setProfileContact] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerDni, setWorkerDni] = useState("");
  const [workerPosition, setWorkerPosition] = useState("");

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
    setContractor(payload.contractor ?? null);
    setWorkers(payload.workers ?? []);
    setDocuments(payload.documents ?? []);
    setRequiredCompanyDocuments(payload.requiredCompanyDocuments ?? []);
    setRequiredWorkerDocuments(payload.requiredWorkerDocuments ?? []);
    setDocumentType((payload.requiredCompanyDocuments ?? [])[0] ?? "");

    if (payload.contractor) {
      setProfileType(payload.contractor.contractor_type === "autonomo" ? "autonomo" : "empresa");
      setProfileName(payload.contractor.company_name ?? "");
      setProfileCif(payload.contractor.company_cif ?? "");
      setProfileContact(payload.contractor.contact_name ?? "");
    } else if (payload.invitation) {
      setProfileName(payload.invitation.company_name ?? "");
      setProfileCif(payload.invitation.company_cif ?? "");
      setProfileContact(payload.invitation.contact_name ?? "");
    }
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la invitacion.");
    });
  }, [token]);

  useEffect(() => {
    const options = ownerType === "worker" ? requiredWorkerDocuments : requiredCompanyDocuments;
    setDocumentType(options[0] ?? "");
    if (ownerType === "worker" && !workerId && workers[0]) setWorkerId(workers[0].id);
  }, [ownerType, requiredCompanyDocuments, requiredWorkerDocuments, workerId, workers]);

  const workerStatusRows = useMemo(
    () =>
      workers.flatMap((worker) =>
        requiredWorkerDocuments.map((type) => ({
          worker,
          type,
          document: latestDocument(documents, "worker", type, worker.id)
        }))
      ),
    [documents, requiredWorkerDocuments, workers]
  );

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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`/api/prl/access/${token}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractorType: profileType,
        companyName: profileName,
        companyCif: profileCif,
        contactName: profileContact
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo guardar el perfil.");
      return;
    }
    setMessage("Perfil PRL actualizado.");
    await load();
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`/api/prl/access/${token}/workers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: workerName, dni: workerDni, position: workerPosition })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo anadir el trabajador.");
      return;
    }
    setWorkerName("");
    setWorkerDni("");
    setWorkerPosition("");
    setMessage("Trabajador anadido.");
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
    form.set("ownerType", ownerType);
    form.set("workerId", workerId);
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
        {invitation ? <p>{invitation.company_name} - {invitation.company_email}</p> : null}
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
                Contrasena
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder={authMode === "register" ? "Crea una contrasena" : "Introduce tu contrasena"}
                />
              </label>
              <button type="submit" disabled={authLoading}>
                {authLoading ? "Comprobando" : authMode === "register" ? "Registrarme y entrar" : "Entrar"}
              </button>
            </form>
          </div>
        ) : (
          <div className="contractor-dashboard">
            <section className="contractor-block">
              <h2>Datos del industrial</h2>
              <form className="contractor-upload" onSubmit={saveProfile}>
                <label>
                  Tipo
                  <select value={profileType} onChange={(event) => setProfileType(event.target.value as ContractorType)}>
                    <option value="empresa">Empresa</option>
                    <option value="autonomo">Autonomo</option>
                  </select>
                </label>
                <label>
                  Nombre fiscal o comercial
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                </label>
                <label>
                  CIF / NIF
                  <input value={profileCif} onChange={(event) => setProfileCif(event.target.value)} />
                </label>
                <label>
                  Contacto
                  <input value={profileContact} onChange={(event) => setProfileContact(event.target.value)} />
                </label>
                <button type="submit">Guardar perfil</button>
              </form>
            </section>

            <section className="contractor-block">
              <h2>Trabajadores</h2>
              <form className="contractor-upload" onSubmit={addWorker}>
                <label>
                  Nombre trabajador
                  <input value={workerName} onChange={(event) => setWorkerName(event.target.value)} placeholder="Nombre y apellidos" />
                </label>
                <label>
                  DNI / NIE
                  <input value={workerDni} onChange={(event) => setWorkerDni(event.target.value)} />
                </label>
                <label>
                  Puesto
                  <input value={workerPosition} onChange={(event) => setWorkerPosition(event.target.value)} placeholder="Electricista, montador..." />
                </label>
                <button type="submit">Anadir trabajador</button>
              </form>
              <div className="contractor-docs compact">
                {workers.length === 0 ? <div className="prl-empty">Sin trabajadores registrados.</div> : null}
                {workers.map((worker) => {
                  const approved = requiredWorkerDocuments.filter((type) => latestDocument(documents, "worker", type, worker.id)?.status === "aprobado").length;
                  return (
                    <article key={worker.id}>
                      <strong>{worker.full_name}</strong>
                      <span>{worker.dni || "-"}</span>
                      <span>{worker.position || "-"}</span>
                      <span>{approved}/{requiredWorkerDocuments.length} docs aprobados</span>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="contractor-block">
              <h2>Subir documentacion</h2>
              <form className="contractor-upload" onSubmit={upload}>
                <label>
                  Para
                  <select value={ownerType} onChange={(event) => setOwnerType(event.target.value as OwnerType)}>
                    <option value="company">{profileType === "autonomo" ? "Autonomo" : "Empresa"}</option>
                    <option value="worker">Trabajador</option>
                  </select>
                </label>
                {ownerType === "worker" ? (
                  <label>
                    Trabajador
                    <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>{worker.full_name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Tipo documento
                  <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                    {(ownerType === "worker" ? requiredWorkerDocuments : requiredCompanyDocuments).map((item) => (
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
                <button type="submit" disabled={uploading || (ownerType === "worker" && workers.length === 0)}>
                  <FileUp size={16} />
                  {uploading ? "Subiendo" : "Subir documento"}
                </button>
              </form>
            </section>

            <section className="contractor-block">
              <h2>Estado documentacion {profileType === "autonomo" ? "autonomo" : "empresa"}</h2>
              <StatusTable rows={requiredCompanyDocuments.map((type) => ({ owner: profileName, type, document: latestDocument(documents, "company", type) }))} />
            </section>

            <section className="contractor-block">
              <h2>Estado documentacion trabajadores</h2>
              {workers.length === 0 ? <div className="prl-empty">Anade trabajadores para gestionar su documentacion.</div> : <StatusTable rows={workerStatusRows.map((row) => ({ owner: row.worker.full_name, type: row.type, document: row.document }))} />}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusTable({
  rows
}: {
  rows: Array<{ owner: string; type: string; document?: DocumentRow }>;
}) {
  return (
    <div className="contractor-status-table">
      <div className="contractor-status-row head">
        <span>Titular</span>
        <span>Documento</span>
        <span>Estado</span>
        <span>Archivo</span>
        <span>Caducidad</span>
      </div>
      {rows.map((row) => {
        const status = row.document?.status ?? "pendiente";
        return (
          <div className="contractor-status-row" key={`${row.owner}-${row.type}`}>
            <span>{row.owner || "-"}</span>
            <strong>{row.type}</strong>
            <span className={`prl-badge ${statusClass(status)}`}>{statusText[status] ?? status}</span>
            <span>{row.document?.signed_url ? <a href={row.document.signed_url} target="_blank">Ver archivo</a> : "Pendiente"}</span>
            <span>{row.document?.expiry_date ?? "-"}</span>
          </div>
        );
      })}
    </div>
  );
}
