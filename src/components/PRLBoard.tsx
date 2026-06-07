"use client";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  Edit3,
  FileText,
  GraduationCap,
  Home,
  Mail,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, FormEvent, WheelEvent } from "react";
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
  | { kind: "subcontractor"; parent: PrlInvitation | null }
  | { kind: "worker"; parent: PrlInvitation | null }
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

type PrlCompanyDirectory = {
  key: string;
  company_name: string;
  company_email: string;
  company_cif: string | null;
  contact_name: string | null;
  contractor_id: string | null;
  contractor_type: string | null;
};

type PrlPayload = {
  invitations: PrlInvitation[];
  documents: RemotePrlDocument[];
  workers: PrlWorker[];
  contractors: PrlContractor[];
  companyDirectory: PrlCompanyDirectory[];
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
  const [payload, setPayload] = useState<PrlPayload>({
    invitations: [],
    documents: [],
    workers: [],
    contractors: [],
    companyDirectory: []
  });
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
  const [treeParentId, setTreeParentId] = useState("");

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
      contractors: data.contractors ?? [],
      companyDirectory: data.companyDirectory ?? []
    });
  }

  useEffect(() => {
    loadRemotePrl().catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo cargar PRL."));
  }, [projectId]);

  const filteredInvitations = payload.invitations;

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
    setTreeParentId(action?.parent?.id ?? "");
    setMessage("");
  }

  async function saveTreeCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treeAction || treeAction.kind === "worker") return;
    const parentInvitationId = treeAction.parent?.id ?? treeParentId;
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
        role: treeRole || "Subcontrata",
        parentInvitationId: parentInvitationId || null
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la empresa.");
      return;
    }
    setTreeAction(null);
    setMessage("Subcontrata creada.");
    await loadRemotePrl();
  }

  async function saveTreeWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treeAction || treeAction.kind !== "worker") return;
    const parentInvitation = treeAction.parent ?? payload.invitations.find((invitation) => invitation.id === treeParentId);
    const response = await fetch("/api/prl/workers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        invitationId: parentInvitation?.id ?? null,
        contractorId: parentInvitation?.contractor_id ?? null,
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
        <div className="prl-admin-main">
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
                invitations={payload.invitations}
                companyDirectory={payload.companyDirectory}
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
  invitations,
  companyDirectory,
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
  invitations: PrlInvitation[];
  companyDirectory: PrlCompanyDirectory[];
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
    action.kind === "subcontractor"
      ? `Anadir subcontrata de ${action.parent?.company_name ?? "Contrata General"}`
      : `Anadir trabajador de ${action.parent ? action.parent.company_name : "Contrata General KJP Retail"}`;

  if (action.kind === "worker") {
    return (
      <div className="tree-modal-backdrop">
        <form className="tree-action-modal" onSubmit={onSaveWorker}>
          <h2>{title}</h2>
          {!action.parent && invitations.length > 0 ? <p className="tree-modal-hint">Se guardara como trabajador de Contrata General KJP Retail.</p> : null}
          <label>Nombre trabajador<input value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></label>
          <label>DNI / NIE<input value={workerDni} onChange={(event) => setWorkerDni(event.target.value)} /></label>
          <label>Puesto<input value={workerPosition} onChange={(event) => setWorkerPosition(event.target.value)} /></label>
          <div className="tree-modal-actions">
            <button className="primary" type="submit">Crear trabajador</button>
            <button type="button" onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="tree-modal-backdrop">
      <form className="tree-action-modal" onSubmit={onSaveCompany}>
        <h2>{title}</h2>
        <p className="tree-modal-hint">Se guardara como subcontrata directa de {action.parent?.company_name ?? "Contrata General"}.</p>
        <label className="tree-modal-wide">Empresa registrada
          <select
            defaultValue=""
            onChange={(event) => {
              const selected = companyDirectory.find((item) => item.key === event.target.value);
              if (!selected) {
                setCompany("");
                setEmail("");
                setCif("");
                setContact("");
                return;
              }
              setCompany(selected.company_name);
              setEmail(selected.company_email);
              setCif(selected.company_cif ?? "");
              setContact(selected.contact_name ?? "");
            }}
          >
            <option value="">Nueva empresa / introducir datos manualmente</option>
            {companyDirectory.map((item) => (
              <option key={item.key} value={item.key}>
                {item.company_name} - {item.company_cif || item.company_email}
              </option>
            ))}
          </select>
        </label>
        <label>Empresa<input required value={company} onChange={(event) => setCompany(event.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>CIF / NIF<input value={cif} onChange={(event) => setCif(event.target.value)} /></label>
        <label>Contacto<input value={contact} onChange={(event) => setContact(event.target.value)} /></label>
        <label>Rol<input value={role} onChange={(event) => setRole(event.target.value)} /></label>
        <div className="tree-modal-actions">
          <button className="primary" type="submit">Crear y enviar invitacion</button>
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function StructureView({
  invitations,
  workers,
  onAddSubcontractor,
  onAddWorker
}: {
  invitations: PrlInvitation[];
  workers: PrlWorker[];
  onAddSubcontractor: (parent: PrlInvitation | null) => void;
  onAddWorker: (parent: PrlInvitation | null) => void;
}) {
  const [treeZoom, setTreeZoom] = useState(1);
  const rootInvitations = invitations.filter((invitation) => !invitation.parent_invitation_id);
  const childInvitations = (parentId: string) => invitations.filter((invitation) => invitation.parent_invitation_id === parentId);
  const workerNameKey = (worker: PrlWorker) => worker.full_name.trim().toLowerCase();
  const assignedWorkerNames = new Set(workers.filter((worker) => worker.invitation_id).map(workerNameKey));
  const rootWorkers = workers.filter((worker) => !worker.invitation_id && !worker.contractor_id && !assignedWorkerNames.has(workerNameKey(worker)));
  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    setTreeZoom((current) => Math.min(1.45, Math.max(0.65, Number((current + delta).toFixed(2)))));
  };

  return (
    <section className="structure-card">
      <div className="structure-viewport" onWheel={handleWheelZoom}>
        <div className="structure-canvas" style={{ "--tree-zoom": treeZoom } as CSSProperties}>
          <div className="org-root">
            <OrgCard
              title="CONTRATA GENERAL"
              subtitle="KJP Retail Construction"
              tone="blue"
              meta="Responsables: jm / knarik"
              onAddSubcontractor={() => onAddSubcontractor(null)}
              onAddWorker={() => onAddWorker(null)}
            />
            <div className="org-worker-list root-workers">
              {rootWorkers.map((worker) => (
                <span key={worker.id}><Users size={13} />{worker.full_name}</span>
              ))}
            </div>
          </div>
          <div className="org-branches">
            {rootInvitations.length === 0 ? <div className="prl-empty">Sin empresas invitadas todavia.</div> : null}
            {rootInvitations.map((invitation, index) => (
              <OrgNode
                key={invitation.id}
                invitation={invitation}
                depth={0}
                toneIndex={index}
                workers={workers}
                childInvitations={childInvitations}
                onAddSubcontractor={onAddSubcontractor}
                onAddWorker={onAddWorker}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrgNode({
  invitation,
  depth,
  toneIndex,
  workers,
  childInvitations,
  onAddSubcontractor,
  onAddWorker
}: {
  invitation: PrlInvitation;
  depth: number;
  toneIndex: number;
  workers: PrlWorker[];
  childInvitations: (parentId: string) => PrlInvitation[];
  onAddSubcontractor: (parent: PrlInvitation | null) => void;
  onAddWorker: (parent: PrlInvitation | null) => void;
}) {
  const linkedWorkers = workers.filter((worker) => worker.invitation_id === invitation.id);
  const children = childInvitations(invitation.id);
  const className = depth === 0 ? "org-column" : "org-child-group";

  return (
    <div className={className}>
      <OrgCard
        title={invitation.company_name}
        subtitle={invitation.role || invitation.company_email}
        tone={companyTone(toneIndex + depth)}
        meta={`Responsable: ${invitation.contact_name || "Pendiente"}`}
        onAddSubcontractor={() => onAddSubcontractor(invitation)}
        onAddWorker={() => onAddWorker(invitation)}
      />
      {children.length ? (
        <div className="org-children">
          {children.map((child, childIndex) => (
            <OrgNode
              key={child.id}
              invitation={child}
              depth={depth + 1}
              toneIndex={toneIndex + childIndex + 1}
              workers={workers}
              childInvitations={childInvitations}
              onAddSubcontractor={onAddSubcontractor}
              onAddWorker={onAddWorker}
            />
          ))}
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
}

function OrgCard({
  title,
  subtitle,
  tone,
  meta,
  onAddSubcontractor,
  onAddWorker
}: {
  title: string;
  subtitle: string;
  tone: string;
  meta: string;
  onAddSubcontractor?: () => void;
  onAddWorker: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className={`org-card ${tone}`}>
      <div className="org-icon"><Building2 size={26} /></div>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
        <small><Users size={12} /> {meta}</small>
      </div>
      <div className="org-card-actions">
        <button type="button" onClick={() => setMenuOpen((open) => !open)}><Plus size={16} /></button>
        {menuOpen ? (
          <div className="org-add-menu">
            <button type="button" onClick={() => { setMenuOpen(false); onAddWorker(); }}>Agregar trabajador en empresa</button>
            {onAddSubcontractor ? (
              <button type="button" onClick={() => { setMenuOpen(false); onAddSubcontractor(); }}>Agregar subcontrata</button>
            ) : null}
          </div>
        ) : null}
      </div>
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
          const invitation = worker.invitation_id
            ? invitations.find((item) => item.id === worker.invitation_id)
            : invitations.find((item) => item.contractor_id === worker.contractor_id);
          const docs = documents.filter((document) => document.owner_id === worker.id);
          return (
            <div className="admin-table-row" key={worker.id}>
              <strong>{worker.full_name}</strong>
              <span>{worker.dni || "-"}</span>
              <span>{invitation?.company_name || "Contrata General KJP Retail"}</span>
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
