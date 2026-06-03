import { NextResponse } from "next/server";
import { fetchProjectCostsFromHolded } from "@/lib/holded";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
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

    const rows = projects.map((project) => ({
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
      return NextResponse.json({ projects, persisted: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects, persisted: true });
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
