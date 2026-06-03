"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TenderBudget, TenderChapter, TenderItem, TenderState, TenderSubchapter } from "@/lib/tender-types";
import { normalizeTenderState } from "@/lib/tender-utils";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nowLabel() {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function emptyItem(): TenderItem {
  return { id: cryptoId(), code: "", description: "Nueva partida", unit: "ud", quantity: 1, cost: 0, margin: 30 };
}

export default function BudgetEditor({ projectId, budgetId }: { projectId: string; budgetId: string }) {
  const storageKey = `kjp-licitacion-${projectId}`;
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<TenderState>({ budgets: [] });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setState(normalizeTenderState(JSON.parse(saved) as TenderState));
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [loaded, state, storageKey]);

  const budget = state.budgets.find((item) => item.id === budgetId) ?? null;
  const total = useMemo(
    () =>
      budget?.chapters.reduce(
        (chapterSum, chapter) =>
          chapterSum + chapter.subchapters.reduce((subSum, sub) => subSum + sub.items.reduce((sum, item) => sum + item.quantity * item.cost * (1 + item.margin / 100), 0), 0),
        0
      ) ?? 0,
    [budget]
  );

  function itemCostAmount(item: TenderItem) {
    return item.quantity * item.cost;
  }

  function itemPrice(item: TenderItem) {
    return item.cost * (1 + item.margin / 100);
  }

  function itemAmount(item: TenderItem) {
    return item.quantity * itemPrice(item);
  }

  function subchapterCost(subchapter: TenderSubchapter) {
    return subchapter.items.reduce((sum, item) => sum + itemCostAmount(item), 0);
  }

  function subchapterAmount(subchapter: TenderSubchapter) {
    return subchapter.items.reduce((sum, item) => sum + itemAmount(item), 0);
  }

  function chapterCost(chapter: TenderChapter) {
    return chapter.subchapters.reduce((sum, subchapter) => sum + subchapterCost(subchapter), 0);
  }

  function chapterAmount(chapter: TenderChapter) {
    return chapter.subchapters.reduce((sum, subchapter) => sum + subchapterAmount(subchapter), 0);
  }

  function marginFrom(cost: number, amount: number) {
    return cost > 0 ? ((amount - cost) / cost) * 100 : 0;
  }

  function updateBudget(mutator: (budget: TenderBudget) => TenderBudget) {
    setState((current) => ({
      budgets: current.budgets.map((item) => (item.id === budgetId ? { ...mutator(item), updatedAt: nowLabel() } : item))
    }));
  }

  function addChapter() {
    updateBudget((current) => ({
      ...current,
      chapters: [
        ...current.chapters,
        { id: cryptoId(), name: `Capítulo ${current.chapters.length + 1}`, subchapters: [{ id: cryptoId(), name: "Subcapítulo 1", items: [] }] }
      ]
    }));
  }

  function updateChapter(chapterId: string, patch: Partial<TenderChapter>) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) => (chapter.id === chapterId ? { ...chapter, ...patch } : chapter))
    }));
  }

  function addSubchapter(chapterId: string) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, subchapters: [...chapter.subchapters, { id: cryptoId(), name: `Subcapítulo ${chapter.subchapters.length + 1}`, items: [] }] }
          : chapter
      )
    }));
  }

  function updateSubchapter(chapterId: string, subchapterId: string, patch: Partial<TenderSubchapter>) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, subchapters: chapter.subchapters.map((sub) => (sub.id === subchapterId ? { ...sub, ...patch } : sub)) }
          : chapter
      )
    }));
  }

  function addItem(chapterId: string, subchapterId: string) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              subchapters: chapter.subchapters.map((sub) => (sub.id === subchapterId ? { ...sub, items: [...sub.items, emptyItem()] } : sub))
            }
          : chapter
      )
    }));
  }

  function updateItem(chapterId: string, subchapterId: string, itemId: string, patch: Partial<TenderItem>) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              subchapters: chapter.subchapters.map((sub) =>
                sub.id === subchapterId ? { ...sub, items: sub.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) } : sub
              )
            }
          : chapter
      )
    }));
  }

  function deleteItem(chapterId: string, subchapterId: string, itemId: string) {
    updateBudget((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              subchapters: chapter.subchapters.map((sub) => (sub.id === subchapterId ? { ...sub, items: sub.items.filter((item) => item.id !== itemId) } : sub))
            }
          : chapter
      )
    }));
  }

  if (!budget) {
    return (
      <main className="budget-editor-clean">
        <Link href={`/licitacion/${projectId}`} className="back-link clean">
          <ArrowLeft size={16} />
          Licitación
        </Link>
        <div className="empty clean">No se ha encontrado este presupuesto.</div>
      </main>
    );
  }

  return (
    <main className="budget-editor-clean">
      <header className="budget-editor-head">
        <Link href={`/licitacion/${projectId}`} className="back-link clean">
          <ArrowLeft size={16} />
          Licitación
        </Link>
        <div>
          <p className="eyebrow clean">Presupuesto</p>
          <input value={budget.title} onChange={(event) => updateBudget((current) => ({ ...current, title: event.target.value }))} />
        </div>
        <strong>{money.format(total)}</strong>
      </header>

      <section className="editor-toolbar-clean">
        <button onClick={addChapter}>
          <Plus size={18} />
          Capítulo
        </button>
      </section>

      <section className="boq-table-shell">
        <div className="boq-row head">
          <span />
          <span>Código</span>
          <span>N</span>
          <span>Ud</span>
          <span>Resumen</span>
          <span>Cantidad</span>
          <span>Coste</span>
          <span>Importe coste</span>
          <span>% Margen</span>
          <span>Precio</span>
          <span>Importe</span>
          <span />
        </div>
        {budget.chapters.map((chapter, chapterIndex) => {
          const cCost = chapterCost(chapter);
          const cAmount = chapterAmount(chapter);
          return (
            <article className="boq-group" key={chapter.id}>
              <div className="boq-row chapter">
                <span className="triangle">▾</span>
                <strong>{String(chapterIndex + 1).padStart(2, "0")}</strong>
                <span>CAP</span>
                <span />
                <input value={chapter.name} onChange={(event) => updateChapter(chapter.id, { name: event.target.value })} />
                <strong>1,00</strong>
                <strong>{money.format(cCost)}</strong>
                <strong>{money.format(cCost)}</strong>
                <strong>{marginFrom(cCost, cAmount).toFixed(2)}</strong>
                <strong>{money.format(cAmount)}</strong>
                <strong>{money.format(cAmount)}</strong>
                <button onClick={() => addSubchapter(chapter.id)}>
                  <Plus size={15} />
                </button>
              </div>
              {chapter.subchapters.map((subchapter, subIndex) => {
                const sCost = subchapterCost(subchapter);
                const sAmount = subchapterAmount(subchapter);
                return (
                  <div className="boq-subgroup" key={subchapter.id}>
                    <div className="boq-row subchapter">
                      <span className="triangle">▾</span>
                      <strong>
                        {String(chapterIndex + 1).padStart(2, "0")}.{String(subIndex + 1).padStart(2, "0")}
                      </strong>
                      <span>SUB</span>
                      <span />
                      <input value={subchapter.name} onChange={(event) => updateSubchapter(chapter.id, subchapter.id, { name: event.target.value })} />
                      <strong>1,00</strong>
                      <strong>{money.format(sCost)}</strong>
                      <strong>{money.format(sCost)}</strong>
                      <strong>{marginFrom(sCost, sAmount).toFixed(2)}</strong>
                      <strong>{money.format(sAmount)}</strong>
                      <strong>{money.format(sAmount)}</strong>
                      <button onClick={() => addItem(chapter.id, subchapter.id)}>
                        <Plus size={15} />
                      </button>
                    </div>
                    {subchapter.items.map((item) => (
                      <div className="boq-row item" key={item.id}>
                        <span />
                        <input value={item.code} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { code: event.target.value })} />
                        <span>PAR</span>
                        <input value={item.unit} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { unit: event.target.value })} />
                        <input value={item.description} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { description: event.target.value })} />
                        <input type="number" value={item.quantity} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { quantity: parseNumber(event.target.value) })} />
                        <input type="number" value={item.cost} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { cost: parseNumber(event.target.value) })} />
                        <strong>{money.format(itemCostAmount(item))}</strong>
                        <input type="number" value={item.margin} onChange={(event) => updateItem(chapter.id, subchapter.id, item.id, { margin: parseNumber(event.target.value) })} />
                        <strong>{money.format(itemPrice(item))}</strong>
                        <strong>{money.format(itemAmount(item))}</strong>
                        <button className="danger-clean icon-only" onClick={() => deleteItem(chapter.id, subchapter.id, item.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </article>
          );
        })}
      </section>
    </main>
  );
}
