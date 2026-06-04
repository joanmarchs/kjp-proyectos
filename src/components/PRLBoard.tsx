"use client";

import { AlertTriangle, ArrowLeft, Check, FileUp, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type DocumentStatus = "pendiente" | "revision" | "aprobado" | "rechazado" | "caducado" | "no_aplica";
type DocumentCategory = "empresa" | "trabajador" | "maquinaria" | "obra";
type TabKey = "empresas" | "trabajadores" | "maquinaria" | "obra" | "alertas";

type PrlCompany = {
  id: string;
  name: string;
  cif: string;
  contact: string;
  email: string;
  role: string;
};

type PrlWorker = {
  id: string;
  name: string;
  dni: string;
  company: string;
  position: string;
};

type PrlMachine = {
  id: string;
  name: string;
  type: string;
  company: string;
  serial: string;
  nextReview: string;
};

type PrlDocument = {
  id: string;
  type: string;
  category: DocumentCategory;
  owner: string;
  fileName: string;
  status: DocumentStatus;
  uploadedAt: string;
  issueDate: string;
  expiryDate: string;
  uploadedBy: string;
  reviewedBy: string;
  reviewedAt: string;
  internalComment: string;
  rejectionComment: string;
};

type PrlInvitation = {
  id: string;
  company_name: string;
  company_email: string;
  company_cif: string | null;
  contact_name: string | null;
  role: string | null;
  status: string;
  token: string;
  created_at: string;
};

type RemotePrlDocument = {
  id: string;
  company_name: string;
  company_email: string;
  document_type: string;
  file_name: string;
  status: DocumentStatus;
  expiry_date: string | null;
  signed_url?: string | null;
  rejection_comment?: string | null;
};

type PrlState = {
  companies: PrlCompany[];
  workers: PrlWorker[];
  machines: PrlMachine[];
  documents: PrlDocument[];
};

const tabs: Array<[TabKey, string]> = [
  ["empresas", "Empresas"],
  ["trabajadores", "Trabajadores"],
  ["maquinaria", "Maquinaria / Equipos"],
  ["obra", "Documentos de obra"],
  ["alertas", "Alertas"]
];

const statusLabels: Record<DocumentStatus, string> = {
  pendiente: "Pendiente de subir",
  revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  caducado: "Caducado",
  no_aplica: "No aplica"
};

const categoryLabels: Record<DocumentCategory, string> = {
  empresa: "Empresa",
  trabajador: "Trabajador",
  maquinaria: "Maquinaria",
  obra: "Obra"
};

const defaultDocumentTypes: Record<DocumentCategory, string[]> = {
  empresa: [
    "CIF",
    "Seguro responsabilidad civil",
    "Certificado AEAT",
    "Certificado Seguridad Social",
    "Servicio de prevención",
    "Evaluación de riesgos",
    "Planificación preventiva",
    "Adhesión al Plan de Seguridad y Salud"
  ],
  trabajador: [
    "DNI/NIE",
    "Alta Seguridad Social",
    "Formación PRL",
    "Reconocimiento médico",
    "Entrega de EPIs",
    "Información de riesgos",
    "Autorizaciones específicas"
  ],
  maquinaria: ["Marcado CE", "Manual de instrucciones", "Revisión/mantenimiento", "Seguro", "Autorización del operador"],
  obra: [
    "Plan de Seguridad y Salud",
    "Acta aprobación PSS",
    "Apertura centro de trabajo",
    "Libro de subcontratación",
    "Designación CSS",
    "Actas de coordinación"
  ]
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function daysUntil(date: string) {
  if (!date) return null;
  const end = new Date(`${date}T00:00:00`).getTime();
  const now = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.ceil((end - now) / 86400000);
}

function effectiveStatus(document: PrlDocument): DocumentStatus {
  const remaining = daysUntil(document.expiryDate);
  if (document.status === "aprobado" && remaining !== null && remaining < 0) return "caducado";
  return document.status;
}

function initialState(projectName: string): PrlState {
  return {
    companies: [
      {
        id: uid("company"),
        name: "Subcontrata pendiente",
        cif: "",
        contact: "",
        email: "",
        role: "Pendiente definir"
      }
    ],
    workers: [],
    machines: [],
    documents: defaultDocumentTypes.obra.map((type) => ({
      id: uid("doc"),
      type,
      category: "obra",
      owner: projectName,
      fileName: "",
      status: "pendiente",
      uploadedAt: "",
      issueDate: "",
      expiryDate: "",
      uploadedBy: "",
      reviewedBy: "",
      reviewedAt: "",
      internalComment: "",
      rejectionComment: ""
    }))
  };
}

function ownerOptions(state: PrlState, category: DocumentCategory, projectName: string) {
  if (category === "empresa") return state.companies.map((company) => company.name);
  if (category === "trabajador") return state.workers.map((worker) => worker.name);
  if (category === "maquinaria") return state.machines.map((machine) => machine.name);
  return [projectName];
}

export default function PRLBoard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const storageKey = `kjp-prl-${projectId}`;
  const [state, setState] = useState<PrlState>(() => initialState(projectName));
  const [tab, setTab] = useState<TabKey>("empresas");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [category, setCategory] = useState<DocumentCategory>("empresa");
  const [docType, setDocType] = useState(defaultDocumentTypes.empresa[0]);
  const [owner, setOwner] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [fileName, setFileName] = useState("");
  const [invitations, setInvitations] = useState<PrlInvitation[]>([]);
  const [remoteDocuments, setRemoteDocuments] = useState<RemotePrlDocument[]>([]);
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCif, setInviteCif] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setState(JSON.parse(saved) as PrlState);
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  async function loadRemotePrl() {
    const response = await fetch(`/api/prl/project/${projectId}`);
    const payload = await response.json();
    if (!response.ok) {
      setInviteMessage(payload.error ?? "No se pudo cargar PRL de Supabase.");
      return;
    }
    setInvitations(payload.invitations ?? []);
    setRemoteDocuments(payload.documents ?? []);
  }

  useEffect(() => {
    loadRemotePrl().catch((error) => setInviteMessage(error instanceof Error ? error.message : "No se pudo cargar PRL."));
  }, [projectId]);

  useEffect(() => {
    setDocType(defaultDocumentTypes[category][0]);
    setOwner(ownerOptions(state, category, projectName)[0] ?? "");
  }, [category, projectName, state.companies, state.machines, state.workers]);

  const documents = useMemo(
    () =>
      state.documents
        .map((document) => ({ ...document, status: effectiveStatus(document) }))
        .filter((document) => (tab === "obra" ? document.category === "obra" : tab === "alertas" ? true : document.category === tab.slice(0, -1)))
        .filter((document) => (statusFilter === "all" ? true : document.status === statusFilter))
        .filter((document) => {
          const term = query.trim().toLowerCase();
          if (!term) return true;
          return [document.type, document.owner, document.fileName, document.internalComment, document.rejectionComment].some((value) =>
            value.toLowerCase().includes(term)
          );
        }),
    [query, state.documents, statusFilter, tab]
  );

  const alerts = useMemo(
    () =>
      state.documents
        .map((document) => ({ ...document, status: effectiveStatus(document), remaining: daysUntil(document.expiryDate) }))
        .filter(
          (document) =>
            document.status === "caducado" ||
            document.status === "rechazado" ||
            document.status === "pendiente" ||
            document.status === "revision" ||
            (document.status === "aprobado" && document.remaining !== null && document.remaining >= 0 && document.remaining <= 30)
        ),
    [state.documents]
  );

  const totals = useMemo(() => {
    const docs = state.documents.map((document) => ({ ...document, status: effectiveStatus(document) }));
    const approved = docs.filter((document) => document.status === "aprobado" || document.status === "no_aplica").length;
    return {
      completion: docs.length ? Math.round((approved / docs.length) * 100) : 0,
      pending: docs.filter((document) => document.status === "pendiente" || document.status === "revision").length,
      rejected: docs.filter((document) => document.status === "rechazado").length,
      expired: docs.filter((document) => document.status === "caducado").length,
      soon: alerts.filter((document) => document.status === "aprobado" && document.remaining !== null && document.remaining <= 30).length
    };
  }, [alerts, state.documents]);

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedOwner = owner || ownerOptions(state, category, projectName)[0] || projectName;
    setState((current) => ({
      ...current,
      documents: [
        {
          id: uid("doc"),
          type: docType,
          category,
          owner: selectedOwner,
          fileName,
          status: fileName ? "revision" : "pendiente",
          uploadedAt: fileName ? todayIso() : "",
          issueDate,
          expiryDate,
          uploadedBy: fileName ? "KJP" : "",
          reviewedBy: "",
          reviewedAt: "",
          internalComment: "",
          rejectionComment: ""
        },
        ...current.documents
      ]
    }));
    setIssueDate("");
    setExpiryDate("");
    setFileName("");
  }

  function updateDocument(id: string, patch: Partial<PrlDocument>) {
    setState((current) => ({
      ...current,
      documents: current.documents.map((document) => (document.id === id ? { ...document, ...patch } : document))
    }));
  }

  function approveDocument(id: string) {
    updateDocument(id, { status: "aprobado", reviewedBy: "KJP", reviewedAt: todayIso(), rejectionComment: "" });
  }

  function rejectDocument(id: string) {
    const comment = window.prompt("Comentario obligatorio de rechazo");
    if (!comment?.trim()) return;
    updateDocument(id, { status: "rechazado", reviewedBy: "KJP", reviewedAt: todayIso(), rejectionComment: comment.trim() });
  }

  function deleteDocument(id: string) {
    setState((current) => ({ ...current, documents: current.documents.filter((document) => document.id !== id) }));
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteMessage("");
    const response = await fetch("/api/prl/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectName,
        companyName: inviteCompany,
        companyEmail: inviteEmail,
        companyCif: inviteCif,
        contactName: inviteContact,
        role: inviteRole
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setInviteMessage(payload.error ?? "No se pudo crear la invitación.");
      return;
    }
    setInviteCompany("");
    setInviteEmail("");
    setInviteCif("");
    setInviteContact("");
    setInviteRole("");
    setInviteMessage("Invitación creada. Se ha abierto el email tipo para enviar.");
    window.location.href = payload.mailto;
    await loadRemotePrl();
  }

  async function reviewRemoteDocument(id: string, status: "aprobado" | "rechazado") {
    const rejectionComment = status === "rechazado" ? window.prompt("Comentario obligatorio de rechazo") : "";
    if (status === "rechazado" && !rejectionComment?.trim()) return;
    const response = await fetch(`/api/prl/documents/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, rejectionComment })
    });
    const payload = await response.json();
    if (!response.ok) {
      setInviteMessage(payload.error ?? "No se pudo revisar el documento.");
      return;
    }
    await loadRemotePrl();
  }

  return (
    <main className="prl-page">
      <header className="prl-header">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={16} />
            Volver a proyectos
          </Link>
          <p className="eyebrow clean">Documentación PRL / CAE</p>
          <h1>{projectName}</h1>
        </div>
        <div className="prl-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documento, empresa o trabajador" />
        </div>
      </header>

      <section className="prl-summary">
        <SummaryCard label="% documentación" value={`${totals.completion}%`} tone={totals.completion >= 90 ? "ok" : "warn"} />
        <SummaryCard label="Empresas" value={state.companies.length.toString()} />
        <SummaryCard label="Trabajadores" value={state.workers.length.toString()} />
        <SummaryCard label="Pendientes" value={totals.pending.toString()} tone="warn" />
        <SummaryCard label="Rechazados" value={totals.rejected.toString()} tone="bad" />
        <SummaryCard label="Caducados" value={totals.expired.toString()} tone="bad" />
        <SummaryCard label="Próx. caducar" value={totals.soon.toString()} tone="warn" />
      </section>

      <section className="prl-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </section>

      <section className="prl-workspace">
        <aside className="prl-panel">
          <h2>Invitar empresa / autónomo</h2>
          <form className="prl-upload" onSubmit={createInvitation}>
            <label>
              Empresa o autónomo
              <input value={inviteCompany} onChange={(event) => setInviteCompany(event.target.value)} placeholder="Nombre fiscal o comercial" />
            </label>
            <label>
              Email acceso
              <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="empresa@email.com" />
            </label>
            <label>
              CIF / NIF
              <input value={inviteCif} onChange={(event) => setInviteCif(event.target.value)} />
            </label>
            <label>
              Contacto
              <input value={inviteContact} onChange={(event) => setInviteContact(event.target.value)} />
            </label>
            <label>
              Rol en obra
              <input value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} placeholder="Electricidad, clima, pintura..." />
            </label>
            <button type="submit">Crear invitación PRL</button>
          </form>
          {inviteMessage ? <p className="prl-inline-message">{inviteMessage}</p> : null}

          <h2>Subir / registrar documento</h2>
          <form className="prl-upload" onSubmit={addDocument}>
            <label>
              Categoría
              <select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo documento
              <select value={docType} onChange={(event) => setDocType(event.target.value)}>
                {defaultDocumentTypes[category].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Relacionado con
              <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Empresa, trabajador, equipo u obra" />
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
              <input type="file" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
            </label>
            <button type="submit">
              <FileUp size={16} />
              Registrar documento
            </button>
          </form>
        </aside>

        <section className="prl-panel prl-main-panel">
          <div className="prl-admin-grid">
            <div className="prl-data-block">
              <h2>Empresas invitadas</h2>
              <div className="prl-admin-list">
                {invitations.length === 0 ? <div className="prl-empty">Sin invitaciones enviadas.</div> : null}
                {invitations.map((invitation) => (
                  <article key={invitation.id}>
                    <strong>{invitation.company_name}</strong>
                    <span>{invitation.company_email}</span>
                    <span>{invitation.role || "Rol pendiente"}</span>
                    <span className="prl-badge revision">{invitation.status}</span>
                  </article>
                ))}
              </div>
            </div>
            <div className="prl-data-block">
              <h2>Documentos subidos por empresas</h2>
              <div className="prl-admin-list">
                {remoteDocuments.length === 0 ? <div className="prl-empty">Todavía no hay documentos externos.</div> : null}
                {remoteDocuments.map((document) => (
                  <article key={document.id}>
                    <strong>{document.document_type}</strong>
                    <span>{document.company_name}</span>
                    <span>{document.file_name}</span>
                    <span className={`prl-badge ${document.status}`}>{statusLabels[document.status] ?? document.status}</span>
                    {document.signed_url ? <a href={document.signed_url} target="_blank">Ver</a> : null}
                    <button onClick={() => reviewRemoteDocument(document.id, "aprobado")}>Aprobar</button>
                    <button onClick={() => reviewRemoteDocument(document.id, "rechazado")}>Rechazar</button>
                  </article>
                ))}
              </div>
            </div>
          </div>
          {tab === "empresas" ? <CompaniesTable companies={state.companies} documents={state.documents} /> : null}
          {tab === "trabajadores" ? <WorkersTable workers={state.workers} documents={state.documents} /> : null}
          {tab === "maquinaria" ? <MachinesTable machines={state.machines} documents={state.documents} /> : null}
          {tab === "alertas" ? <AlertsTable alerts={alerts} /> : null}
          {tab !== "alertas" ? (
            <>
              <div className="prl-table-head">
                <h2>{tab === "obra" ? "Documentos de obra" : "Documentos vinculados"}</h2>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DocumentStatus | "all")}>
                  <option value="all">Todos los estados</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <DocumentsTable documents={documents} onApprove={approveDocument} onReject={rejectDocument} onDelete={deleteDocument} />
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, tone = "" }: { label: string; value: string; tone?: "ok" | "warn" | "bad" | "" }) {
  return (
    <div className={`prl-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusCounts(documents: PrlDocument[], owner: string) {
  const related = documents.filter((document) => document.owner === owner).map((document) => ({ ...document, status: effectiveStatus(document) }));
  return {
    required: related.length,
    approved: related.filter((document) => document.status === "aprobado" || document.status === "no_aplica").length,
    pending: related.filter((document) => document.status === "pendiente" || document.status === "revision").length,
    expired: related.filter((document) => document.status === "caducado").length
  };
}

function CompaniesTable({ companies, documents }: { companies: PrlCompany[]; documents: PrlDocument[] }) {
  return (
    <DataTable
      title="Empresas"
      headers={["Nombre", "CIF", "Contacto", "Rol", "Estado", "Docs"]}
      rows={companies.map((company) => {
        const counts = statusCounts(documents, company.name);
        return [company.name, company.cif || "-", company.contact || company.email || "-", company.role, prlStatus(counts), `${counts.approved}/${counts.required}`];
      })}
    />
  );
}

function WorkersTable({ workers, documents }: { workers: PrlWorker[]; documents: PrlDocument[] }) {
  return (
    <DataTable
      title="Trabajadores"
      headers={["Nombre", "DNI/NIE", "Empresa", "Puesto", "Estado", "Pendientes"]}
      rows={workers.map((worker) => {
        const counts = statusCounts(documents, worker.name);
        return [worker.name, worker.dni || "-", worker.company, worker.position, prlStatus(counts), counts.pending.toString()];
      })}
      empty="Sin trabajadores registrados todavía."
    />
  );
}

function MachinesTable({ machines, documents }: { machines: PrlMachine[]; documents: PrlDocument[] }) {
  return (
    <DataTable
      title="Maquinaria / Equipos"
      headers={["Equipo", "Tipo", "Empresa", "Serie/Matrícula", "Próx. revisión", "Estado"]}
      rows={machines.map((machine) => {
        const counts = statusCounts(documents, machine.name);
        return [machine.name, machine.type, machine.company, machine.serial || "-", machine.nextReview || "-", prlStatus(counts)];
      })}
      empty="Sin maquinaria registrada todavía."
    />
  );
}

function DataTable({ title, headers, rows, empty = "Sin registros." }: { title: string; headers: string[]; rows: string[][]; empty?: string }) {
  return (
    <div className="prl-data-block">
      <h2>{title}</h2>
      <div className="prl-table">
        <div className="prl-table-row head" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(120px, 1fr))` }}>
          {headers.map((header) => (
            <span key={header}>{header}</span>
          ))}
        </div>
        {rows.length ? (
          rows.map((row, index) => (
            <div className="prl-table-row" key={`${title}-${index}`} style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(120px, 1fr))` }}>
              {row.map((cell, cellIndex) => (
                <span key={`${cell}-${cellIndex}`}>{cell}</span>
              ))}
            </div>
          ))
        ) : (
          <div className="prl-empty">{empty}</div>
        )}
      </div>
    </div>
  );
}

function prlStatus(counts: { required: number; approved: number; pending: number; expired: number }) {
  if (counts.required === 0) return "No aplica";
  if (counts.expired > 0) return "Caducado";
  if (counts.pending > 0) return "Pendiente";
  if (counts.approved === counts.required) return "Completo";
  return "En revisión";
}

function DocumentsTable({
  documents,
  onApprove,
  onReject,
  onDelete
}: {
  documents: PrlDocument[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="prl-doc-list">
      {documents.length === 0 ? <div className="prl-empty">Sin documentos para este filtro.</div> : null}
      {documents.map((document) => (
        <article className="prl-doc-card" key={document.id}>
          <div>
            <span className={`prl-badge ${document.status}`}>{statusLabels[document.status]}</span>
            <h3>{document.type}</h3>
            <p>
              {categoryLabels[document.category]} · {document.owner}
            </p>
            <p>{document.fileName || "Archivo pendiente de subir"}</p>
            {document.expiryDate ? <p>Caduca: {document.expiryDate}</p> : null}
            {document.rejectionComment ? <p>Rechazo: {document.rejectionComment}</p> : null}
          </div>
          <div className="prl-doc-actions">
            <button onClick={() => onApprove(document.id)}>
              <Check size={15} />
              Aprobar
            </button>
            <button onClick={() => onReject(document.id)}>
              <X size={15} />
              Rechazar
            </button>
            <button className="danger" onClick={() => onDelete(document.id)}>
              <Trash2 size={15} />
              Eliminar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function AlertsTable({ alerts }: { alerts: Array<PrlDocument & { remaining: number | null }> }) {
  return (
    <div className="prl-alerts">
      {alerts.length === 0 ? <div className="prl-empty">Sin alertas documentales.</div> : null}
      {alerts.map((alert) => (
        <article className={`prl-alert ${alert.status}`} key={alert.id}>
          <AlertTriangle size={18} />
          <div>
            <strong>{alert.type}</strong>
            <span>
              {alert.owner} · {statusLabels[alert.status]}
              {alert.remaining !== null && alert.remaining >= 0 ? ` · caduca en ${alert.remaining} días` : ""}
            </span>
          </div>
          <p>{alert.status === "rechazado" ? "Revisar comentario y solicitar nueva versión." : "Revisar y actualizar documentación."}</p>
        </article>
      ))}
    </div>
  );
}
