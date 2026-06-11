import { NextResponse } from "next/server";
import { fetchProjectCostsFromHolded } from "@/lib/holded";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function projectStatus(value: unknown): ProjectStatus {
  return value === "pendiente_adjudicar" ||
    value === "desestimado" ||
    value === "fase_estudio" ||
    value === "fase_obra" ||
    value === "pendiente_facturar" ||
    value === "facturado"
    ? value
    : "fase_estudio";
}

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const projects = await fetchProjectCostsFromHolded();
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({
        projects,
        persisted: false,
        message: "Datos reales leídos de Holded. Falta SUPABASE_SERVICE_ROLE_KEY para guardarlos en Supabase."
      });
    }

    const { data: existingRows } = await supabase.from("project_costs_2026").select("id,raw");
    const localRowsByHoldedId = new Map(
      (existingRows ?? [])
        .map((row: { id: string; raw?: { holded_id?: string | null } | null }) => [row.raw?.holded_id, row] as const)
        .filter(([holdedId]) => typeof holdedId === "string" && holdedId)
    );
    const existingStatuses = new Map(
      (existingRows ?? []).map((row: { id: string; raw?: { status?: ProjectStatus } | null }) => [row.id, projectStatus(row.raw?.status)])
    );

    const projectsWithStatus = projects.map((project) => {
      const linkedRow = localRowsByHoldedId.get(project.id);
      const id = linkedRow?.id ?? project.id;
      return {
        ...project,
        id,
        status: existingStatuses.get(id) ?? "fase_estudio",
        holded_id: project.id,
        local_project: Boolean(linkedRow)
      };
    });

    const rows = projectsWithStatus.map((project) => ({
      id: project.id,
      name: project.name,
      start_date: project.startDate,
      cost: project.cost,
      sales: project.sales,
      profit: project.profit,
      suppliers: project.suppliers,
      categories: project.categories,
      raw: project,
      synced_at: new Date().toISOString()
    }));

    let { error } = await supabase.from("project_costs_2026").upsert(rows, { onConflict: "id" });
    if (error && error.message.includes("start_date")) {
      const rowsWithoutStartDate = rows.map(({ start_date, ...row }) => row);
      const fallback = await supabase.from("project_costs_2026").upsert(rowsWithoutStartDate, { onConflict: "id" });
      error = fallback.error;
    }
    if (error) {
      return NextResponse.json({ projects: projectsWithStatus, persisted: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects: projectsWithStatus, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { projects: [], persisted: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
