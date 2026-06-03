import type { CostTuple, ProjectCost } from "./types";

type HoldedRecord = Record<string, unknown>;

const REPORT_START_YEAR = 2025;
const REPORT_END_YEAR = 2026;

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoDate(value: unknown): string | null {
  const timestamp = asNumber(value);
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getArray(payload: unknown): HoldedRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is HoldedRecord => Boolean(item) && typeof item === "object");
  if (payload && typeof payload === "object" && Array.isArray((payload as HoldedRecord).data)) {
    return ((payload as HoldedRecord).data as unknown[]).filter((item): item is HoldedRecord => Boolean(item) && typeof item === "object");
  }
  return [];
}

async function holdedGet(path: string, query?: Record<string, string | number>, init?: RequestInit) {
  const apiKey = process.env.HOLDED_API_KEY;
  const baseUrl = process.env.HOLDED_API_BASE_URL ?? "https://api.holded.com/api";

  if (!apiKey) {
    throw new Error("Falta HOLDED_API_KEY en .env.local");
  }

  const url = new URL(`${baseUrl}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const response = await fetch(url, {
    ...init,
    headers: {
      key: apiKey,
      accept: "application/json",
      "content-type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Holded ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json();
}

function monthRanges(startYear: number, endYear: number): Array<{ starttmp: number; endtmp: number }> {
  const ranges: Array<{ starttmp: number; endtmp: number }> = [];

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
      ranges.push({ starttmp: Math.floor(start.getTime() / 1000), endtmp: Math.floor(end.getTime() / 1000) });
    }
  }

  return ranges;
}

async function holdedDocumentsByMonth(type: string): Promise<HoldedRecord[]> {
  const seen = new Set<string>();
  const documents: HoldedRecord[] = [];

  for (const range of monthRanges(REPORT_START_YEAR, REPORT_END_YEAR)) {
    const payload = await holdedGet(`/invoicing/v1/documents/${type}`, range);
    for (const document of getArray(payload)) {
      const id = asString(document.id) || `${asString(document.docNumber)}-${asString(document.date)}`;
      const key = `${type}-${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push(document);
    }
  }

  return documents;
}

function documentTotal(doc: HoldedRecord): number {
  return asNumber(doc.total) || asNumber(doc.totalAmount) || asNumber(doc.amount) || asNumber(doc.subtotal);
}

function documentSubtotal(doc: HoldedRecord): number {
  return asNumber(doc.subtotal) || documentTotal(doc);
}

function documentProjectKey(doc: HoldedRecord, projectNames: Map<string, string>): { id: string; name: string } | null {
  const candidates = [
    asString(doc.projectId),
    asString(doc.projectid),
    asString(doc.project_id),
    asString(doc.project),
    asString(doc.projectName)
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (projectNames.has(candidate)) return { id: candidate, name: projectNames.get(candidate) ?? candidate };
  }

  const text = `${asString(doc.project)} ${asString(doc.projectName)} ${asString(doc.desc)} ${asString(doc.description)} ${asString(doc.notes)} ${asString(doc.reference)}`.toLowerCase();
  for (const [id, name] of projectNames) {
    if (text.includes(name.toLowerCase())) return { id, name };
  }

  return null;
}

function lineProjectKey(line: HoldedRecord, projectNames: Map<string, string>): { id: string; name: string } | null {
  const id = asString(line.projectid) || asString(line.projectId) || asString(line.project_id) || asString(line.project);
  if (id && projectNames.has(id)) return { id, name: projectNames.get(id) ?? id };
  return null;
}

function documentLines(doc: HoldedRecord): HoldedRecord[] {
  const items = Array.isArray(doc.products) ? doc.products : Array.isArray(doc.items) ? doc.items : [];
  return items.filter((item): item is HoldedRecord => Boolean(item) && typeof item === "object");
}

function lineTotal(line: HoldedRecord): number {
  const units = asNumber(line.units) || 1;
  const price = asNumber(line.price);
  const discount = asNumber(line.discount);
  const explicit = asNumber(line.total) || asNumber(line.subtotal) || asNumber(line.amount);

  if (explicit) return explicit;
  return price * units * (1 - discount / 100);
}

function supplierName(doc: HoldedRecord): string {
  return (
    asString(doc.contactName) ||
    asString(doc.supplierName) ||
    asString(doc.name) ||
    asString(doc.contact) ||
    "Sin proveedor"
  );
}

function addAmount(bucket: Map<string, number>, name: string, amount: number) {
  const key = name || "Sin clasificar";
  bucket.set(key, (bucket.get(key) ?? 0) + amount);
}

function topTuples(bucket: Map<string, number>, limit = 10): CostTuple[] {
  return [...bucket.entries()]
    .map(([name, amount]) => [name, Number(amount.toFixed(2))] as CostTuple)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function addPurchaseCategories(doc: HoldedRecord, amount: number, bucket: Map<string, number>) {
  const items = documentLines(doc);
  if (!items.length) {
    addAmount(bucket, asString(doc.expenseAccountName) || asString(doc.categoryName) || "Compras", amount);
    return;
  }

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const line = item as HoldedRecord;
    const lineAmount = asNumber(line.total) || asNumber(line.subtotal) || asNumber(line.amount) || amount / items.length;
    const category = asString(line.accountName) || asString(line.categoryName) || asString(line.name) || "Compras";
    addAmount(bucket, category, lineAmount);
  }
}

export async function fetchProjectCostsFromHolded(): Promise<ProjectCost[]> {
  const [projectsPayload, invoices, creditNotes, purchases, purchaseRefunds] = await Promise.all([
    holdedGet("/projects/v1/projects"),
    holdedDocumentsByMonth("invoice"),
    holdedDocumentsByMonth("creditnote"),
    holdedDocumentsByMonth("purchase"),
    holdedDocumentsByMonth("purchaserefund")
  ]);

  const projects = getArray(projectsPayload);

  const projectNames = new Map<string, string>();
  const result = new Map<string, ProjectCost & { supplierBucket: Map<string, number>; categoryBucket: Map<string, number> }>();

  for (const project of projects) {
    const id = asString(project.id) || asString(project._id);
    const name = asString(project.name) || asString(project.title) || id;
    if (!id || !name) continue;
    projectNames.set(id, name);
    result.set(id, {
      id,
      name,
      startDate: asIsoDate(project.date),
      cost: 0,
      sales: 0,
      profit: 0,
      suppliers: [],
      categories: [],
      supplierBucket: new Map(),
      categoryBucket: new Map()
    });
  }

  function addSalesDocument(doc: HoldedRecord, sign: 1 | -1) {
    const lines = documentLines(doc);
    const projectLines = lines
      .map((line) => ({ line, project: lineProjectKey(line, projectNames) }))
      .filter((item): item is { line: HoldedRecord; project: { id: string; name: string } } => Boolean(item.project));
    const uniqueProjectIds = [...new Set(projectLines.map((item) => item.project.id))];

    if (uniqueProjectIds.length === 1) {
      const current = result.get(uniqueProjectIds[0]);
      if (current) current.sales += sign * documentSubtotal(doc);
      return;
    }

    if (uniqueProjectIds.length > 1) {
      const totalLines = projectLines.reduce((sum, item) => sum + Math.abs(lineTotal(item.line)), 0);
      for (const item of projectLines) {
        const current = result.get(item.project.id);
        if (!current) continue;
        const weight = totalLines > 0 ? Math.abs(lineTotal(item.line)) / totalLines : 1 / projectLines.length;
        current.sales += sign * documentSubtotal(doc) * weight;
      }
      return;
    }

    const project = documentProjectKey(doc, projectNames);
    if (!project) return;
    const current = result.get(project.id);
    if (!current) return;
    current.sales += sign * documentSubtotal(doc);
  }

  for (const invoice of invoices) {
    addSalesDocument(invoice, 1);
  }

  for (const creditNote of creditNotes) {
    addSalesDocument(creditNote, -1);
  }

  function addPurchaseDocument(doc: HoldedRecord, sign: 1 | -1) {
    const lines = documentLines(doc);
    const projectLines = lines
      .map((line) => ({ line, project: lineProjectKey(line, projectNames) }))
      .filter((item): item is { line: HoldedRecord; project: { id: string; name: string } } => Boolean(item.project));
    const uniqueProjectIds = [...new Set(projectLines.map((item) => item.project.id))];

    if (uniqueProjectIds.length === 1) {
      const current = result.get(uniqueProjectIds[0]);
      const amount = sign * documentSubtotal(doc);
      if (!current) return;
      current.cost += amount;
      addAmount(current.supplierBucket, supplierName(doc), amount);
      addPurchaseCategories(doc, amount, current.categoryBucket);
      return;
    }

    if (uniqueProjectIds.length > 1) {
      const totalLines = projectLines.reduce((sum, item) => sum + Math.abs(lineTotal(item.line)), 0);
      for (const item of projectLines) {
        const current = result.get(item.project.id);
        if (!current) continue;
        const weight = totalLines > 0 ? Math.abs(lineTotal(item.line)) / totalLines : 1 / projectLines.length;
        const amount = sign * documentSubtotal(doc) * weight;
        current.cost += amount;
        addAmount(current.supplierBucket, supplierName(doc), amount);
        addAmount(current.categoryBucket, asString(item.line.account) || asString(item.line.name) || "Compras", amount);
      }
      return;
    }

    const project = documentProjectKey(doc, projectNames);
    if (!project) return;
    const current = result.get(project.id);
    if (!current) return;
    const amount = sign * documentSubtotal(doc);
    current.cost += amount;
    addAmount(current.supplierBucket, supplierName(doc), amount);
    addPurchaseCategories(doc, amount, current.categoryBucket);
  }

  for (const purchase of purchases) {
    addPurchaseDocument(purchase, 1);
  }

  for (const purchaseRefund of purchaseRefunds) {
    addPurchaseDocument(purchaseRefund, -1);
  }

  return [...result.values()]
    .map((project) => ({
      id: project.id,
      name: project.name,
      startDate: project.startDate,
      cost: Number(project.cost.toFixed(2)),
      sales: Number(project.sales.toFixed(2)),
      profit: Number((project.sales - project.cost).toFixed(2)),
      suppliers: topTuples(project.supplierBucket),
      categories: topTuples(project.categoryBucket)
    }))
    .sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost));
}

export async function createHoldedProject(input: { name: string; startDate?: string | null }) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("El nombre del proyecto es obligatorio.");
  }

  const created = (await holdedGet("/projects/v1/projects", undefined, {
    method: "POST",
    body: JSON.stringify({ name })
  })) as HoldedRecord;

  const id = asString(created.id) || asString(created._id);
  if (!id) {
    return { id: "", name, startDate: input.startDate ?? null, raw: created };
  }

  if (input.startDate) {
    const timestamp = Math.floor(new Date(`${input.startDate}T00:00:00`).getTime() / 1000);
    if (Number.isFinite(timestamp)) {
      await holdedGet(`/projects/v1/projects/${id}`, undefined, {
        method: "PUT",
        body: JSON.stringify({ date: timestamp })
      });
    }
  }

  return { id, name, startDate: input.startDate ?? null, raw: created };
}

export async function updateHoldedProject(input: { id: string; name: string; startDate?: string | null }) {
  const id = input.id.trim();
  const name = input.name.trim();
  if (!id || !name) {
    throw new Error("Faltan datos para editar el proyecto.");
  }

  const body: Record<string, string | number> = { name };
  if (input.startDate) {
    const timestamp = Math.floor(new Date(`${input.startDate}T00:00:00`).getTime() / 1000);
    if (Number.isFinite(timestamp)) body.date = timestamp;
  }

  await holdedGet(`/projects/v1/projects/${id}`, undefined, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  return { id, name, startDate: input.startDate ?? null };
}

export async function deleteHoldedProject(id: string) {
  const projectId = id.trim();
  if (!projectId) {
    throw new Error("Falta el ID del proyecto.");
  }

  await holdedGet(`/projects/v1/projects/${projectId}`, undefined, {
    method: "DELETE"
  });
}
