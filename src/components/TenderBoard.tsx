"use client";

import { ArrowLeft, FileUp, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectCost } from "@/lib/types";
import type { TenderBudget, TenderChapter, TenderItem, TenderState } from "@/lib/tender-types";
import { normalizeTenderState } from "@/lib/tender-utils";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function budgetTotal(budget: TenderBudget) {
  return budget.chapters.reduce(
    (chapterSum, chapter) =>
      chapterSum +
      chapter.subchapters.reduce(
        (subSum, subchapter) => subSum + subchapter.items.reduce((itemSum, item) => itemSum + item.quantity * item.cost * (1 + item.margin / 100), 0),
        0
      ),
    0
  );
}

function countItems(budget: TenderBudget) {
  return budget.chapters.reduce(
    (chapterSum, chapter) => chapterSum + chapter.subchapters.reduce((subSum, subchapter) => subSum + subchapter.items.length, 0),
    0
  );
}

function parseBc3(content: string): TenderItem[] {
  return content
    .split(/\r?\n/)
    .filter((row) => row.startsWith("~C|"))
    .map((row) => {
      const parts = row.split("|");
      return {
        id: cryptoId(),
        code: parts[1]?.trim() ?? "",
        unit: parts[2]?.trim() || "ud",
        description: parts[3]?.trim() || parts[1]?.trim() || "Partida BC3",
        quantity: 1,
        cost: parseNumber(parts[4] ?? "0"),
        margin: 30
      };
    })
    .filter((item) => item.code || item.description);
}

function makeBudget(title: string, items: TenderItem[] = []): TenderBudget {
  const now = nowLabel();
  const chapters: TenderChapter[] = [
    {
      id: cryptoId(),
      name: items.length ? "Capítulo BC3" : "Capítulo 1",
      subchapters: [
        {
          id: cryptoId(),
          name: items.length ? "Partidas importadas" : "Subcapítulo 1",
          items
        }
      ]
    }
  ];

  return {
    id: cryptoId(),
    title,
    status: items.length ? "En estudio" : "Borrador",
    createdAt: now,
    updatedAt: now,
    chapters
  };
}

export default function TenderBoard({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectCost | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<TenderState>({ budgets: [] });
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageKey = `kjp-licitacion-${projectId}`;

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/projects");
      const payload = await response.json();
      const projects = (payload.projects ?? []) as ProjectCost[];
      setProject(projects.find((item) => item.id === projectId) ?? null);

      const saved = localStorage.getItem(storageKey);
      if (saved) setState(normalizeTenderState(JSON.parse(saved) as TenderState));
      setLoaded(true);
    }

    load().catch(() => setLoaded(true));
  }, [projectId, storageKey]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [loaded, state, storageKey]);

  const totals = useMemo(
    () => ({
      budgets: state.budgets.length,
      items: state.budgets.reduce((sum, budget) => sum + countItems(budget), 0),
      amount: state.budgets.reduce((sum, budget) => sum + budgetTotal(budget), 0)
    }),
    [state.budgets]
  );

  function addBudget(items: TenderItem[] = [], fallbackTitle?: string) {
    const budgetTitle = title.trim() || fallbackTitle || `Presupuesto ${state.budgets.length + 1}`;
    const budget = makeBudget(budgetTitle, items);
    setState((current) => ({ budgets: [...current.budgets, budget] }));
    setTitle("");
  }

  async function importBc3(file: File) {
    const content = await file.text();
    addBudget(parseBc3(content), file.name.replace(/\.bc3$/i, ""));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeBudget(id: string) {
    if (!window.confirm("Eliminar este presupuesto?")) return;
    setState((current) => ({ budgets: current.budgets.filter((budget) => budget.id !== id) }));
  }

  function saveTitle(id: string) {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    setState((current) => ({
      budgets: current.budgets.map((budget) =>
        budget.id === id ? { ...budget, title: nextTitle, updatedAt: nowLabel() } : budget
      )
    }));
    setEditingId(null);
    setEditingTitle("");
  }

  return (
    <main className="tender-home">
      <header className="tender-hero-clean">
        <Link href="/" className="back-link clean">
          <ArrowLeft size={16} />
          Proyectos
        </Link>
        <div>
          <p className="eyebrow clean">Licitación</p>
          <h1>{project?.name ?? "Proyecto"}</h1>
          <p>Presupuestos independientes de Holded, con creación manual o importación BC3.</p>
        </div>
      </header>

      <section className="tender-metrics-clean">
        <div>
          <span>Presupuestos</span>
          <strong>{totals.budgets}</strong>
        </div>
        <div>
          <span>Partidas</span>
          <strong>{totals.items}</strong>
        </div>
        <div>
          <span>Total estimado</span>
          <strong>{money.format(totals.amount)}</strong>
        </div>
      </section>

      <section className="budget-create-clean">
        <label>
          <span>Nuevo presupuesto</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Lote carpintería" />
        </label>
        <button onClick={() => addBudget()}>
          <Plus size={18} />
          Crear manual
        </button>
        <input ref={fileInputRef} type="file" accept=".bc3" hidden onChange={(event) => event.target.files?.[0] && importBc3(event.target.files[0])} />
        <button className="secondary-clean" onClick={() => fileInputRef.current?.click()}>
          <FileUp size={18} />
          Subir BC3
        </button>
      </section>

      <section className="budget-grid-clean">
        {state.budgets.length === 0 ? (
          <div className="empty clean">Crea un presupuesto manual o sube un archivo BC3 para empezar.</div>
        ) : null}
        {state.budgets.map((budget) => (
          <article className="budget-card-clean" key={budget.id}>
            <div className="budget-icon-clean">
              <FolderKanban size={22} />
            </div>
            <div className="budget-card-main">
              {editingId === budget.id ? (
                <div className="budget-edit-title">
                  <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} />
                  <button onClick={() => saveTitle(budget.id)}>Guardar</button>
                </div>
              ) : (
                <h2>{budget.title}</h2>
              )}
              <p>
                {countItems(budget)} partidas · {budget.chapters.length} capítulos
              </p>
              <div className="budget-card-meta">
                <span>{budget.status}</span>
                <span>Creado {budget.createdAt}</span>
                <span>{money.format(budgetTotal(budget))}</span>
              </div>
            </div>
            <div className="budget-card-actions">
              <Link href={`/licitacion/${projectId}/presupuesto/${budget.id}`} target="_blank">
                Abrir
              </Link>
              <button
                onClick={() => {
                  setEditingId(budget.id);
                  setEditingTitle(budget.title);
                }}
              >
                <Pencil size={16} />
              </button>
              <button className="danger-clean" onClick={() => removeBudget(budget.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
