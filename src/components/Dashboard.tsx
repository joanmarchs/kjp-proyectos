"use client";

import { ArrowDownUp, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectCost, ProjectStatus } from "@/lib/types";

type Filter = "all" | "profit" | "loss" | "large";
type SortKey = "name" | "startDate" | "cost" | "sales" | "profit";
type SortDirection = "asc" | "desc";

const statusLabels: Record<ProjectStatus, string> = {
  fase_estudio: "Fase estudio",
  pendiente_adjudicar: "Pendiente de adjudicar",
  desestimado: "Desestimado"
};

const statusOptions = Object.entries(statusLabels) as Array<[ProjectStatus, string]>;

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function fmt(value: number) {
  return formatter.format(value);
}

function fmtDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function classFor(project: ProjectCost) {
  const margin = project.sales > 0 ? project.profit / project.sales : 0;
  if (project.profit < 0) return "loss";
  if (margin < 0.1) return "break-even";
  return "profit";
}

function margin(project: ProjectCost) {
  return project.sales > 0 ? (project.profit / project.sales) * 100 : 0;
}

function nextProjectNumber(projects: ProjectCost[]) {
  const numbers = projects
    .map((project) => project.name.match(/^\s*(\d{3})(?=\s+)/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 169);

  return Math.max(168, ...numbers) + 1;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectCost[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProjects() {
    setLoading(true);
    const response = await fetch("/api/projects");
    const payload = await response.json();
    setProjects(payload.projects ?? []);
    setMessage(payload.message ?? payload.error ?? "");
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    setMessage("");
    const response = await fetch("/api/sync", { method: "POST" });
    const payload = await response.json();
    setProjects(payload.projects ?? []);
    setMessage(payload.persisted === false ? payload.message ?? payload.error ?? "" : "Sincronización completada.");
    setSyncing(false);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = newProjectName.trim();
    const nameWithoutNumber = trimmedName.replace(/^\d+\s*/, "").trim();
    if (!nameWithoutNumber) {
      setMessage("Escribe el nombre del proyecto después del número.");
      return;
    }

    const name = /^\d+/.test(trimmedName) ? trimmedName : `${nextProjectNumber(projects)} ${trimmedName}`;

    setCreating(true);
    setMessage("");
    const response = await fetch("/api/create-project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, startDate: newProjectStartDate || null })
    });
    const payload = await response.json();
    setCreating(false);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear el proyecto en Holded.");
      return;
    }

    setNewProjectName("");
    setNewProjectStartDate("");
    setShowCreate(false);
    setMessage(payload.folder?.path ? `Proyecto creado en Holded y carpeta preparada: ${payload.folder.path}` : "Proyecto creado en Holded.");
    await loadProjects();
  }

  function startEdit(project: ProjectCost) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditStartDate(project.startDate ?? "");
  }

  async function saveEdit(projectId: string) {
    const name = editName.trim();
    if (!name) {
      setMessage("El nombre del proyecto es obligatorio.");
      return;
    }

    const response = await fetch("/api/project-actions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: projectId, name, startDate: editStartDate || null })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo editar el proyecto.");
      return;
    }

    setEditingId(null);
    setMessage("Proyecto actualizado.");
    await loadProjects();
  }

  async function deleteProject(project: ProjectCost) {
    const confirmed = window.confirm(`Eliminar "${project.name}" de Holded, Supabase y la carpeta de ESTUDIOS?`);
    if (!confirmed) return;

    const response = await fetch("/api/project-actions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: project.id, name: project.name })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo eliminar el proyecto.");
      return;
    }

    setMessage(payload.folder?.deleted ? `Proyecto eliminado y carpeta borrada: ${payload.folder.path}` : "Proyecto eliminado.");
    await loadProjects();
  }

  async function changeProjectStatus(project: ProjectCost, status: ProjectStatus) {
    if (project.status === status) return;

    setChangingStatusId(project.id);
    setMessage("");
    const response = await fetch("/api/project-actions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: project.id, name: project.name, status })
    });
    const payload = await response.json();
    setChangingStatusId(null);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo cambiar el estado del proyecto.");
      return;
    }

    setProjects((current) => current.map((item) => (item.id === project.id ? { ...item, status } : item)));
    const folderMessage = payload.folder?.moved
      ? ` Carpeta movida de ${payload.folder.from} a ${payload.folder.to}.`
      : payload.folder?.reason
        ? ` ${payload.folder.reason}`
        : "";
    setMessage(`Estado actualizado a ${statusLabels[status]}.${folderMessage}`);
  }

  function toggleCreateForm() {
    setShowCreate((current) => {
      const next = !current;
      if (next && !newProjectName.trim()) {
        setNewProjectName(`${nextProjectNumber(projects)} `);
      }
      return next;
    });
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "name" || nextKey === "startDate" ? "asc" : "desc");
  }

  function toggleYear(year: string) {
    setSelectedYears((current) => (current.includes(year) ? current.filter((item) => item !== year) : [...current, year]));
  }

  useEffect(() => {
    loadProjects().catch((error) => {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los datos.");
      setLoading(false);
    });
  }, []);

  const availableYears = useMemo(
    () =>
      [...new Set(projects.map((project) => project.startDate?.slice(0, 4)).filter((year): year is string => Boolean(year)))]
        .sort((a, b) => Number(b) - Number(a)),
    [projects]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      const projectYear = project.startDate?.slice(0, 4);
      if (filter === "profit" && project.profit < 0) return false;
      if (filter === "loss" && project.profit >= 0) return false;
      if (filter === "large" && project.cost < 50000) return false;
      if (selectedYears.length > 0 && (!projectYear || !selectedYears.includes(projectYear))) return false;
      if (term && !project.name.toLowerCase().includes(term)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" }) * multiplier;
      }

      if (sortKey === "startDate") {
        const aTime = a.startDate ? new Date(`${a.startDate}T00:00:00`).getTime() : 0;
        const bTime = b.startDate ? new Date(`${b.startDate}T00:00:00`).getTime() : 0;
        return (aTime - bTime) * multiplier;
      }

      return (a[sortKey] - b[sortKey]) * multiplier;
    });
  }, [projects, filter, query, selectedYears, sortDirection, sortKey]);

  const summary = useMemo(
    () =>
      visible.reduce(
        (acc, project) => {
          acc.cost += project.cost;
          acc.sales += project.sales;
          acc.profit += project.profit;
          return acc;
        },
        { cost: 0, sales: 0, profit: 0 }
      ),
    [visible]
  );

  return (
    <main>
      <header className="header">
        <div>
          <p className="eyebrow">KJP · Holded + Supabase</p>
          <h1>proyecto KJP</h1>
          <p className="meta">Datos reales de Holded, normalizados y guardados en Supabase.</p>
        </div>
        <div className="header-actions">
          <button
            className="sync secondary"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Salir
          </button>
          <button className="sync secondary" onClick={toggleCreateForm}>
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            Nuevo proyecto
          </button>
          <button className="sync" onClick={sync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>
      </header>

      {showCreate ? (
        <form className="create-project" onSubmit={createProject}>
          <label>
            <span>Nombre</span>
            <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Nombre del proyecto" />
          </label>
          <label>
            <span>Fecha inicio</span>
            <input type="date" value={newProjectStartDate} onChange={(event) => setNewProjectStartDate(event.target.value)} />
          </label>
          <button className="sync" type="submit" disabled={creating}>
            <Plus size={16} />
            {creating ? "Creando" : "Crear en Holded"}
          </button>
        </form>
      ) : null}

      <section className="filters">
        <span className="filter-label">Filtro</span>
        {[
          ["all", "Todos"],
          ["profit", "Con margen"],
          ["loss", "Pérdidas"],
          ["large", "+50k coste"]
        ].map(([key, label]) => (
          <button key={key} className={filter === key ? "filter active" : "filter"} onClick={() => setFilter(key as Filter)}>
            {label}
          </button>
        ))}
        <label className="search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto" />
        </label>
        {availableYears.length > 0 ? (
          <>
            <span className="filter-label sort-label">Años</span>
            <button className={selectedYears.length === 0 ? "filter active year" : "filter year"} onClick={() => setSelectedYears([])}>
              Todos
            </button>
            {availableYears.map((year) => (
              <button key={year} className={selectedYears.includes(year) ? "filter active year" : "filter year"} onClick={() => toggleYear(year)}>
                {year}
              </button>
            ))}
          </>
        ) : null}
        <span className="filter-label sort-label">Orden</span>
        {[
          ["name", "Nombre"],
          ["startDate", "Fecha inicio"],
          ["cost", "Coste"],
          ["sales", "Ventas"],
          ["profit", "Beneficio"]
        ].map(([key, label]) => (
          <button key={key} className={sortKey === key ? "filter active sort" : "filter sort"} onClick={() => changeSort(key as SortKey)}>
            <ArrowDownUp size={13} />
            {label}
            {sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </section>

      <section className="summary">
        <div>
          <span>Coste total</span>
          <strong>{fmt(summary.cost)}</strong>
        </div>
        <div>
          <span>Ventas</span>
          <strong>{fmt(summary.sales)}</strong>
        </div>
        <div>
          <span>Beneficio</span>
          <strong className={summary.profit < 0 ? "bad" : "good"}>{fmt(summary.profit)}</strong>
        </div>
        <div>
          <span>Proyectos</span>
          <strong>{visible.length}</strong>
        </div>
      </section>

      {message ? (
        <div className="notice">
          <TriangleAlert size={16} />
          {message}
        </div>
      ) : null}

      <section className="content">
        {loading ? <div className="empty">Cargando datos...</div> : null}
        {!loading && visible.length === 0 ? <div className="empty">Sin proyectos para mostrar.</div> : null}
        <div className="projects">
          {visible.map((project) => {
            const isOpen = open[project.id];
            const projectClass = classFor(project);
            const projectMargin = margin(project);
            const costPct = project.sales > 0 ? Math.min((project.cost / project.sales) * 100, 100) : 100;

            return (
              <article className={`project-card ${projectClass}`} key={project.id}>
                <button className="project-head" onClick={() => setOpen((current) => ({ ...current, [project.id]: !isOpen }))}>
                  <span className={isOpen ? "toggle open" : "toggle"}>▶</span>
                  <span className="project-name">{project.name}</span>
                  <span className="stat">
                    <small>Inicio</small>
                    {fmtDate(project.startDate)}
                  </span>
                  <span className={`status-pill ${project.status}`}>{statusLabels[project.status]}</span>
                  <span className="stat">
                    <small>Coste</small>
                    {fmt(project.cost)}
                  </span>
                  <span className="stat">
                    <small>Ventas</small>
                    {fmt(project.sales)}
                  </span>
                  <span className="stat">
                    <small>Beneficio</small>
                    <b className={project.profit < 0 ? "bad" : "good"}>{fmt(project.profit)}</b>
                  </span>
                  <span className="margin">
                    <small>Margen {project.sales > 0 ? `${projectMargin.toFixed(1)}%` : "-"}</small>
                    <i>
                      <b style={{ width: `${Math.max(0, Math.min(100, projectMargin))}%` }} />
                    </i>
                  </span>
                </button>

                <div className="project-actions">
                  <label className="status-control">
                    <span>Estado</span>
                    <select
                      value={project.status}
                      disabled={changingStatusId === project.id}
                      onChange={(event) => changeProjectStatus(project, event.target.value as ProjectStatus)}
                    >
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Link href={`/licitacion/${project.id}`} className="project-link-action">
                    Licitación
                  </Link>
                  <button onClick={() => startEdit(project)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button className="danger" onClick={() => deleteProject(project)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>

                {editingId === project.id ? (
                  <div className="edit-project">
                    <label>
                      <span>Nombre</span>
                      <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                    </label>
                    <label>
                      <span>Fecha inicio</span>
                      <input type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} />
                    </label>
                    <button className="sync" onClick={() => saveEdit(project.id)}>Guardar</button>
                    <button className="sync secondary" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                ) : null}

                {isOpen ? (
                  <div className="project-body">
                    <div className="cost-track">
                      <span style={{ width: `${costPct}%` }} />
                    </div>
                    <DataTable title="Proveedores" rows={project.suppliers} total={project.cost} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function DataTable({ title, rows, total }: { title: string; rows: ProjectCost["suppliers"]; total: number }) {
  const max = rows[0]?.[1] || 1;

  return (
    <div className="table-wrap">
      <h2>{title}</h2>
      <table>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td>Sin datos</td>
              <td />
            </tr>
          ) : (
            rows.map(([name, amount], index) => (
              <tr key={`${title}-${name}`}>
                <td>
                  <span>{index + 1}.</span>
                  {name}
                  <i>
                    <b style={{ width: `${(amount / max) * 100}%` }} />
                  </i>
                </td>
                <td>
                  {fmt(amount)}
                  <small>{total > 0 ? `${((amount / total) * 100).toFixed(1)}%` : "-"}</small>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
