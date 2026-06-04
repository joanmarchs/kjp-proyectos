"use client";

import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
  FileText,
  GraduationCap,
  Home,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState, useEffect } from "react";

type DocumentStatus = "pendiente" | "revision" | "aprobado" | "rechazado" | "caducado" | "no_aplica";
type AdminTab = "estructura" | "empresas" | "trabajadores" | "documentacion" | "accesos";

type PrlInvitation = {
  id: string;
  company_name: string;
  company_email: string;
  company_cif: string | null;
  contact_name: string | null;
  role: string | null;
  parent_invitation_id?: string | null;
  status: string;
  token: string;
  contractor_id?: string | null;
  accepted_at?: string | null;
  email_sent_at?: string | null;
  email_error?: string | null;
};

type TreeAction =
  | { kind: "company"; parent: null }
  | { kind: "subcontractor"; parent: PrlInvitation }
  | { kind: "worker"; parent: PrlInvitation }
  | null;

type RemotePrlDocument = {
  id: string;
  company_name: string;
  company_email: string;
  document_type: string;
  owner_type?: "company" | "worker" | null;
  owner_id?: string | null;
  owner_name?: string | null;
  file_name: string;
  status: DocumentStatus;
  expiry_date: string | null;
  signed_url?: string | null;
};

type PrlWorker = {
  id: string;
  contractor_id: string | null;
  invitation_id: string | null;
  full_name: string;
  dni: string | null;
  position: string | null;
};

type PrlContractor = {
  id: string;
  email: string;
  company_name: string;
  company_cif: string | null;
  contact_name: string | null;
  contractor_type?: "empresa" | "autonomo";
};

type PrlPayload = {
  invitations: PrlInvitation[];
  documents: RemotePrlDocument[];
  workers: PrlWorker[];
  contractors: PrlContractor[];
};

const navItems = [
  ["estructura", "Estructura", Building2],
  ["empresas", "Empresas", Home],
  ["trabajadores", "Trabajadores", Users],
  ["documentacion", "Documentacion", FileText],
  ["accesos", "Accesos", ShieldCheck],
  ["formacion", "Formacion", GraduationCap],
  ["incidencias", "Incidencias", AlertCircle],
  ["configuracion", "Configuracion", Settings]
] as const;

const tabs: Array<[AdminTab, string]> = [
  ["estructura", "Arbol de la obra"],
  ["empresas", "Empresas"],
  ["trabajadores", "Trabajadores"],
  ["documentacion", "Documentacion"],
  ["accesos", "Accesos"]
];

const statusLabels: Record<string, string> = {
  invited: "Invitado",
  documents_uploaded: "Docs enviados",
  pendiente: "Pendiente",
  revision: "En revision",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  caducado: "Caducado",
  no_aplica: "No aplica"
};

function badgeClass(status: string) {
  if (status === "aprobado" || status === "documents_uploaded") return "aprobado";
  if (status === "rechazado" || status === "caducado") return "rechazado";
  return "revision";
}

function companyTone(index: number) {
  return ["green", "orange", "purple", "teal"][index % 4];
}

export default function PRLBoard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [tab, setTab] = useState<AdminTab>("estructura");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<PrlPayload>({ invitations: [], documents: [], workers: [], contractors: [] });
  const [message, setMessage] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCif, setInviteCif] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [editingInvitationId, setEditingInvitationId] = useState<string | null>(null);
  const [treeAction, setTreeAction] = useState<TreeAction>(null);
  const [treeCompany, setTreeCompany] = useState("");
  const [treeEmail, setTreeEmail] = useState("");
  const [treeCif, setTreeCif] = useState("");
  const [treeContact, setTreeContact] = useState("");
  const [treeRole, setTreeRole] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerDni, setWorkerDni] = useState("");
  const [workerPosition, setWorkerPosition] = useState("");

  async function loadRemotePrl() {
    const response = await fetch(`/api/prl/project/${projectId}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cargar PRL.");
      return;
    }
    setPayload({
      invitations: data.invitations ?? [],
      documents: data.documents ?? [],
      workers: data.workers ?? [],
      contractors: data.contractors ?? []
    });
  }

  useEffect(() => {
    loadRemotePrl().catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo cargar PRL."));
  }, [projectId]);

  const filteredInvitations = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return payload.invitations;
    return payload.invitations.filter((invitation) =>
      [invitation.company_name, invitation.company_email, invitation.role ?? "", invitation.contact_name ?? ""].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [payload.invitations, query]);

  const totals = useMemo(() => {
    const approved = payload.documents.filter((document) => document.status === "aprobado").length;
    return {
      companies: payload.invitations.length,
      subcontractors: Math.max(payload.invitations.length - 1, 0),
      workers: payload.workers.length,
      documents: payload.documents.length,
      pending: payload.documents.filter((document) => document.status === "revision" || document.status === "pendiente").length,
      rejected: payload.documents.filter((document) => document.status === "rechazado").length,
      completion: payload.documents.length ? Math.round((approved / payload.documents.length) * 100) : 0
    };
  }, [payload]);

  function resetInvitationForm() {
    setInviteCompany("");
    setInviteEmail("");
    setInviteCif("");
    setInviteContact("");
    setInviteRole("");
    setEditingInvitationId(null);
  }

  function startEditInvitation(invitation: PrlInvitation) {
    setEditingInvitationId(invitation.id);
    setInviteCompany(invitation.company_name);
    setInviteEmail(invitation.company_email);
    setInviteCif(invitation.company_cif ?? "");
    setInviteContact(invitation.contact_name ?? "");
    setInviteRole(invitation.role ?? "");
    setMessage("Editando empresa invitada.");
  }

  async function saveInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/prl/invitations", {
      method: editingInvitationId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editingInvitationId,
        projectId,
        projectName,
        companyName: inviteCompany,
        companyEmail: inviteEmail,
        companyCif: inviteCif,
        contactName: inviteContact,
        role: inviteRole
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar la invitacion.");
      return;
    }
    const wasEditing = Boolean(editingInvitationId);
    resetInvitationForm();
    setMessage(wasEditing ? "Empresa actualizada." : data.emailSent ? "Invitacion enviada por email." : `Invitacion creada, email pendiente: ${data.emailError ?? ""}`);
    await loadRemotePrl();
  }

  function openTreeAction(action: TreeAction) {
    setTreeAction(action);
    setTreeCompany("");
    setTreeEmail("");
    setTreeCif("");
    setTreeContact("");
    setTreeRole(action?.kind === "subcontractor" ? "Subcontrata" : "");
    setWorkerName("");
    setWorkerDni("");
    setWorkerPosition("");
    setMessage("");
  }

  async function saveTreeCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treeAction || treeAction.kind === "worker") return;
    const response = await fetch("/api/prl/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectName,
        companyName: treeCompany,
        companyEmail: treeEmail,
        companyCif: treeCif,
        contactName: treeContact,
        role: treeRole || (treeAction.kind === "subcontractor" ? "Subcontrata" : "Empresa principal"),
        parentInvitationId: treeAction.kind === "subcontractor" ? treeAction.parent.id : null
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la empresa.");
      return;
    }
    setTreeAction(null);
    setMessage(treeAction.kind === "subcontractor" ? "Subcontrata creada." : "Empresa creada.");
    await loadRemotePrl();
  }

  async function saveTreeWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treeAction || treeAction.kind !== "worker") return;
    const response = await fetch("/api/prl/workers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        invitationId: treeAction.parent.id,
        contractorId: treeAction.parent.contractor_id,
        fullName: workerName,
        dni: workerDni,
        position: workerPosition
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el trabajador.");
      return;
    }
    setTreeAction(null);
    setMessage("Trabajador creado.");
    await loadRemotePrl();
  }

  async function deleteInvitation(invitation: PrlInvitation) {
    if (!window.confirm(`Eliminar ${invitation.company_name}?`)) return;
    const response = await fetch("/api/prl/invitations", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: invitation.id })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar.");
      return;
    }
    setMessage("Empresa eliminada.");
    await loadRemotePrl();
  }

  async function resendInvitation(invitation: PrlInvitation) {
    const response = await fetch(`/api/prl/invitations/${invitation.id}/resend`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.emailSent) {
      setMessage(data.emailError ?? data.error ?? "No se pudo reenviar.");
      return;
    }
    setMessage("Email reenviado.");
  }

  async function reviewDocument(id: string, status: "aprobado" | "rechazado") {
    const rejectionComment = status === "rechazado" ? window.prompt("Comentario obligatorio de rechazo") : "";
    if (status === "rechazado" && !rejectionComment?.trim()) return;
    const response = await fetch(`/api/prl/documents/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, rejectionComment })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo revisar el documento.");
      return;
    }
    await loadRemotePrl();
  }

  return (
    <main className="prl-admin-shell">
      <aside className="prl-admin-sidebar">
        <div className="prl-brand">
          <ShieldCheck size={34} />
          <div>
            <strong>PRL Gestion</strong>
            <span>Contrata General</span>
          </div>
        </div>
        <nav>
          {navItems.map(([key, label, Icon]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => tabs.some(([tabKey]) => tabKey === key) && setTab(key as AdminTab)}>
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <Link href="/" className="prl-sidebar-help">
          <ArrowLeft size={16} />
          Volver a proyectos
        </Link>
      </aside>

      <section className="prl-admin-content">
        <header className="prl-admin-topbar">
          <div className="prl-admin-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa, trabajador o documento" />
          </div>
          <div className="prl-admin-user">
            <Bell size={19} />
            <span className="notification-dot">3</span>
            <div className="avatar">CG</div>
            <div>
              <strong>Contrata General</strong>
              <span>Administrador</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </header>

        <div className="prl-admin-main">
          <div className="prl-admin-titlebar">
            <div>
              <h1>Estructura de la obra</h1>
              <p>{projectName} · Visualiza y gestiona empresas, trabajadores, accesos y documentacion PRL.</p>
            </div>
            <div className="prl-admin-actions-main">
              <button className="primary" onClick={() => setTab("empresas")}>
                <Plus size={16} />
                Anadir
              </button>
              <button onClick={() => setTab("empresas")}>
                <Edit3 size={16} />
                Editar
              </button>
            </div>
          </div>

          <nav className="prl-admin-tabs">
            {tabs.map(([key, label]) => (
              <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </nav>

          {message ? <div className="prl-admin-notice">{message}</div> : null}

          {tab === "estructura" ? (
            <>
              <TreeActionPanel
                action={treeAction}
                company={treeCompany}
                email={treeEmail}
                cif={treeCif}
                contact={treeContact}
                role={treeRole}
                workerName={workerName}
                workerDni={workerDni}
                workerPosition={workerPosition}
                setCompany={setTreeCompany}
                setEmail={setTreeEmail}
                setCif={setTreeCif}
                setContact={setTreeContact}
                setRole={setTreeRole}
                setWorkerName={setWorkerName}
                setWorkerDni={setWorkerDni}
                setWorkerPosition={setWorkerPosition}
                onCancel={() => setTreeAction(null)}
                onSaveCompany={saveTreeCompany}
                onSaveWorker={saveTreeWorker}
              />
              <StructureView
                invitations={filteredInvitations}
                workers={payload.workers}
                totals={totals}
                onAddCompany={() => openTreeAction({ kind: "company", parent: null })}
                onAddSubcontractor={(parent) => openTreeAction({ kind: "subcontractor", parent })}
                onAddWorker={(parent) => openTreeAction({ kind: "worker", parent })}
              />
            </>
          ) : null}
          {tab === "empresas" ? (
            <CompaniesView
              invitations={filteredInvitations}
              inviteCompany={inviteCompany}
              inviteEmail={inviteEmail}
              inviteCif={inviteCif}
              inviteContact={inviteContact}
              inviteRole={inviteRole}
              editingInvitationId={editingInvitationId}
              setInviteCompany={setInviteCompany}
              setInviteEmail={setInviteEmail}
              setInviteCif={setInviteCif}
              setInviteContact={setInviteContact}
              setInviteRole={setInviteRole}
              saveInvitation={saveInvitation}
              resetInvitationForm={resetInvitationForm}
              startEditInvitation={startEditInvitation}
              resendInvitation={resendInvitation}
              deleteInvitation={deleteInvitation}
            />
          ) : null}
          {tab === "trabajadores" ? <WorkersView workers={payload.workers} invitations={payload.invitations} documents={payload.documents} /> : null}
          {tab === "documentacion" ? <DocumentsView documents={payload.documents} reviewDocument={reviewDocument} /> : null}
          {tab === "accesos" ? <AccessView invitations={filteredInvitations} /> : null}
        </div>
      </section>
    </main>
  );
}

function TreeActionPanel({
  action,
  company,
  email,
  cif,
  contact,
  role,
  workerName,
  workerDni,
  workerPosition,
  setCompany,
  setEmail,
  setCif,
  setContact,
  setRole,
  setWorkerName,
  setWorkerDni,
  setWorkerPosition,
  onCancel,
  onSaveCompany,
  onSaveWorker
}: {
  action: TreeAction;
  company: string;
  email: string;
  cif: string;
  contact: string;
  role: string;
  workerName: string;
  workerDni: string;
  workerPosition: string;
  setCompany: (value: string) => void;
  setEmail: (value: string) => void;
  setCif: (value: string) => void;
  setContact: (value: string) => void;
  setRole: (value: string) => void;
  setWorkerName: (value: string) => void;
  setWorkerDni: (value: string) => void;
  setWorkerPosition: (value: string) => void;
  onCancel: () => void;
  onSaveCompany: (event: FormEvent<HTMLFormElement>) => void;
  onSaveWorker: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!action) return null;
  const title =
    action.kind === "company"
      ? "Anadir empresa principal"
      : action.kind === "subcontractor"
        ? `Anadir subcontrata de ${action.parent.company_name}`
        : `Anadir trabajador de ${action.parent.company_name}`;

  if (action.kind === "worker") {
    return (
      <form className="tree-action-panel" onSubmit={onSaveWorker}>
        <h2>{title}</h2>
        <label>Nombre trabajador<input value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></label>
        <label>DNI / NIE<input value={workerDni} onChange={(event) => setWorkerDni(event.target.value)} /></label>
        <label>Puesto<input value={workerPosition} onChange={(event) => setWorkerPosition(event.target.value)} /></label>
        <button className="primary" type="submit">Crear trabajador</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </form>
    );
  }

  return (
    <form className="tree-action-panel" onSubmit={onSaveCompany}>
      <h2>{title}</h2>
      <label>Empresa<input value={company} onChange={(event) => setCompany(event.target.value)} /></label>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>CIF / NIF<input value={cif} onChange={(event) => setCif(event.target.value)} /></label>
      <label>Contacto<input value={contact} onChange={(event) => setContact(event.target.value)} /></label>
      <label>Rol<input value={role} onChange={(event) => setRole(event.target.value)} /></label>
      <button className="primary" type="submit">Crear y enviar invitacion</button>
      <button type="button" onClick={onCancel}>Cancelar</button>
    </form>
  );
}

function StructureView({
  invitations,
  workers,
  totals,
  onAddCompany,
  onAddSubcontractor,
  onAddWorker
}: {
  invitations: PrlInvitation[];
  workers: PrlWorker[];
  totals: { companies: number; subcontractors: number; workers: number };
  onAddCompany: () => void;
  onAddSubcontractor: (parent: PrlInvitation) => void;
  onAddWorker: (parent: PrlInvitation) => void;
}) {
  const rootInvitations = invitations.filter((invitation) => !invitation.parent_invitation_id);
  const childInvitations = (parentId: string) => invitations.filter((invitation) => invitation.parent_invitation_id === parentId);

  return (
    <section className="structure-card">
      <div className="org-root">
        <OrgCard title="CONTRATA GENERAL" subtitle="KJP Retail Construction" tone="blue" meta="Responsables: jm / knarik" onAdd={onAddCompany} />
      </div>
      <div className="org-branches">
        {rootInvitations.length === 0 ? <div className="prl-empty">Sin empresas invitadas todavia.</div> : null}
        {rootInvitations.map((invitation, index) => {
          const linkedWorkers = workers.filter((worker) => worker.invitation_id === invitation.id || worker.contractor_id === invitation.contractor_id);
          const subcontractors = childInvitations(invitation.id);
          return (
            <div className="org-column" key={invitation.id}>
              <OrgCard
                title={invitation.company_name}
                subtitle={invitation.role || invitation.company_email}
                tone={companyTone(index)}
                meta={`Responsable: ${invitation.contact_name || "Pendiente"}`}
                onAddSubcontractor={() => onAddSubcontractor(invitation)}
                onAddWorker={() => onAddWorker(invitation)}
              />
              {subcontractors.length ? (
                <div className="org-children">
                  {subcontractors.map((subcontractor, subIndex) => {
                    const subcontractorWorkers = workers.filter((worker) => worker.invitation_id === subcontractor.id || worker.contractor_id === subcontractor.contractor_id);
                    return (
                      <div className="org-child-group" key={subcontractor.id}>
                        <OrgCard
                          title={subcontractor.company_name}
                          subtitle={subcontractor.role || "Subcontrata"}
                          tone={companyTone(index + subIndex + 1)}
                          meta={`Responsable: ${subcontractor.contact_name || "Pendiente"}`}
                          onAddSubcontractor={() => onAddSubcontractor(subcontractor)}
                          onAddWorker={() => onAddWorker(subcontractor)}
                        />
                        <div className="org-worker-list">
                          {subcontractorWorkers.map((worker) => <span key={worker.id}><Users size={13} />{worker.full_name}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="org-worker-list">
                {linkedWorkers.map((worker) => <span key={worker.id}><Users size={13} />{worker.full_name}</span>)}
              </div>
              <div className="org-subcard">
                <strong>{linkedWorkers.length}</strong>
                <span>Trabajadores</span>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="structure-footer">
        <span><i className="dot blue" />Contrata General</span>
        <span><i className="dot green" />Empresa Principal</span>
        <span><i className="dot orange" />Subcontrata</span>
        <strong><Building2 size={18} />{totals.companies} Empresas</strong>
        <strong><ClipboardList size={18} />{totals.subcontractors} Subcontratas</strong>
        <strong><Users size={18} />{totals.workers} Trabajadores</strong>
      </footer>
    </section>
  );
}

function OrgCard({
  title,
  subtitle,
  tone,
  meta,
  onAdd,
  onAddSubcontractor,
  onAddWorker
}: {
  title: string;
  subtitle: string;
  tone: string;
  meta: string;
  onAdd?: () => void;
  onAddSubcontractor?: () => void;
  onAddWorker?: () => void;
}) {
  return (
    <article className={`org-card ${tone}`}>
      <div className="org-icon"><Building2 size={26} /></div>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
        <small><Users size={12} /> {meta}</small>
      </div>
      {onAdd ? <button onClick={onAdd}><Plus size={16} /></button> : null}
      {!onAdd && (onAddSubcontractor || onAddWorker) ? (
        <div className="org-card-actions">
          {onAddSubcontractor ? <button title="Anadir subcontrata" onClick={onAddSubcontractor}><Building2 size={15} /></button> : null}
          {onAddWorker ? <button title="Anadir trabajador" onClick={onAddWorker}><Users size={15} /></button> : null}
        </div>
      ) : null}
    </article>
  );
}

function CompaniesView(props: {
  invitations: PrlInvitation[];
  inviteCompany: string;
  inviteEmail: string;
  inviteCif: string;
  inviteContact: string;
  inviteRole: string;
  editingInvitationId: string | null;
  setInviteCompany: (value: string) => void;
  setInviteEmail: (value: string) => void;
  setInviteCif: (value: string) => void;
  setInviteContact: (value: string) => void;
  setInviteRole: (value: string) => void;
  saveInvitation: (event: FormEvent<HTMLFormElement>) => void;
  resetInvitationForm: () => void;
  startEditInvitation: (invitation: PrlInvitation) => void;
  resendInvitation: (invitation: PrlInvitation) => void;
  deleteInvitation: (invitation: PrlInvitation) => void;
}) {
  return (
    <section className="admin-grid-two">
      <form className="admin-panel-card" onSubmit={props.saveInvitation}>
        <h2>{props.editingInvitationId ? "Editar empresa" : "Anadir empresa / autonomo"}</h2>
        <label>Empresa<input value={props.inviteCompany} onChange={(event) => props.setInviteCompany(event.target.value)} /></label>
        <label>Email<input type="email" value={props.inviteEmail} onChange={(event) => props.setInviteEmail(event.target.value)} /></label>
        <label>CIF / NIF<input value={props.inviteCif} onChange={(event) => props.setInviteCif(event.target.value)} /></label>
        <label>Contacto<input value={props.inviteContact} onChange={(event) => props.setInviteContact(event.target.value)} /></label>
        <label>Rol en obra<input value={props.inviteRole} onChange={(event) => props.setInviteRole(event.target.value)} /></label>
        <button className="primary" type="submit">{props.editingInvitationId ? "Guardar cambios" : "Enviar invitacion"}</button>
        {props.editingInvitationId ? <button type="button" onClick={props.resetInvitationForm}>Cancelar</button> : null}
      </form>
      <div className="admin-panel-card wide">
        <h2>Empresas y autonomos</h2>
        <div className="admin-table">
          <div className="admin-table-row head"><span>Empresa</span><span>Email</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>
          {props.invitations.map((invitation) => (
            <div className="admin-table-row" key={invitation.id}>
              <strong>{invitation.company_name}</strong>
              <span>{invitation.company_email}</span>
              <span>{invitation.role || "-"}</span>
              <span className={`prl-badge ${badgeClass(invitation.status)}`}>{statusLabels[invitation.status] ?? invitation.status}</span>
              <div className="row-actions">
                <button onClick={() => props.startEditInvitation(invitation)}><Edit3 size={14} /></button>
                <button onClick={() => props.resendInvitation(invitation)}><Mail size={14} /></button>
                <button className="danger" onClick={() => props.deleteInvitation(invitation)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkersView({ workers, invitations, documents }: { workers: PrlWorker[]; invitations: PrlInvitation[]; documents: RemotePrlDocument[] }) {
  return (
    <section className="admin-panel-card">
      <h2>Trabajadores</h2>
      <div className="admin-table">
        <div className="admin-table-row head"><span>Trabajador</span><span>DNI/NIE</span><span>Empresa</span><span>Puesto</span><span>Docs</span></div>
        {workers.length === 0 ? <div className="prl-empty">Sin trabajadores registrados por industriales.</div> : null}
        {workers.map((worker) => {
          const invitation = invitations.find((item) => item.id === worker.invitation_id || item.contractor_id === worker.contractor_id);
          const docs = documents.filter((document) => document.owner_id === worker.id);
          return (
            <div className="admin-table-row" key={worker.id}>
              <strong>{worker.full_name}</strong>
              <span>{worker.dni || "-"}</span>
              <span>{invitation?.company_name || "-"}</span>
              <span>{worker.position || "-"}</span>
              <span>{docs.filter((doc) => doc.status === "aprobado").length}/{docs.length}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DocumentsView({ documents, reviewDocument }: { documents: RemotePrlDocument[]; reviewDocument: (id: string, status: "aprobado" | "rechazado") => void }) {
  return (
    <section className="admin-panel-card">
      <h2>Documentacion recibida</h2>
      <div className="admin-table docs">
        <div className="admin-table-row head"><span>Documento</span><span>Titular</span><span>Empresa</span><span>Estado</span><span>Archivo</span><span>Revision</span></div>
        {documents.length === 0 ? <div className="prl-empty">Todavia no hay documentos externos.</div> : null}
        {documents.map((document) => (
          <div className="admin-table-row" key={document.id}>
            <strong>{document.document_type}</strong>
            <span>{document.owner_name || document.company_name}</span>
            <span>{document.company_name}</span>
            <span className={`prl-badge ${badgeClass(document.status)}`}>{statusLabels[document.status] ?? document.status}</span>
            <span>{document.signed_url ? <a href={document.signed_url} target="_blank">Ver archivo</a> : "-"}</span>
            <div className="row-actions">
              <button onClick={() => reviewDocument(document.id, "aprobado")}><Check size={14} /></button>
              <button className="danger" onClick={() => reviewDocument(document.id, "rechazado")}><X size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccessView({ invitations }: { invitations: PrlInvitation[] }) {
  return (
    <section className="admin-panel-card">
      <h2>Accesos industriales</h2>
      <div className="admin-table">
        <div className="admin-table-row head"><span>Empresa</span><span>Email</span><span>Invitacion</span><span>Cuenta</span><span>Email PRL</span></div>
        {invitations.map((invitation) => (
          <div className="admin-table-row" key={invitation.id}>
            <strong>{invitation.company_name}</strong>
            <span>{invitation.company_email}</span>
            <span>{invitation.accepted_at ? "Aceptada" : "Pendiente"}</span>
            <span>{invitation.contractor_id ? "Registrada" : "Sin registrar"}</span>
            <span>{invitation.email_error ? "Error email" : invitation.email_sent_at ? "Enviado" : "Pendiente"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
