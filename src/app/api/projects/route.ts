import { NextResponse } from "next/server";
import { fetchProjectCostsFromHolded } from "@/lib/holded";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProjectCost } from "@/lib/types";

export const dynamic = "force-dynamic";

type DbProject = {
  id: string;
  name: string;
  start_date: string | null;
  cost: number | string;
  sales: number | string;
  profit: number | string;
  suppliers: ProjectCost["suppliers"];
  categories: ProjectCost["categories"];
  raw?: Partial<ProjectCost> | null;
  synced_at: string;
};

function fromDb(row: DbProject): ProjectCost {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date ?? row.raw?.startDate ?? null,
    cost: Number(row.cost),
    sales: Number(row.sales),
    profit: Number(row.profit),
    suppliers: row.suppliers ?? [],
    categories: row.categories ?? [],
    syncedAt: row.synced_at
  };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const projects = await fetchProjectCostsFromHolded();
    return NextResponse.json({
      projects,
      source: "holded",
      message: "Datos reales de Holded. Añade SUPABASE_SERVICE_ROLE_KEY para guardarlos en Supabase."
    });
  }

  let { data, error }: { data: DbProject[] | null; error: { message: string } | null } = await supabase
    .from("project_costs_2026")
    .select("id,name,start_date,cost,sales,profit,suppliers,categories,raw,synced_at")
    .order("cost", { ascending: false });

  if (error && error.message.includes("start_date")) {
    const fallback = await supabase
      .from("project_costs_2026")
      .select("id,name,cost,sales,profit,suppliers,categories,raw,synced_at")
      .order("cost", { ascending: false });
    data = (fallback.data as DbProject[] | null)?.map((row) => ({ ...row, start_date: null })) ?? null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ projects: [], source: "supabase", error: error.message }, { status: 500 });
  }

  const projects = (data as DbProject[]).map(fromDb);
  if (projects.length === 0) {
    return NextResponse.json({
      projects: await fetchProjectCostsFromHolded(),
      source: "holded",
      message: "Supabase no tiene filas todavía. Pulsa Sincronizar para guardar estos datos."
    });
  }

  return NextResponse.json({ projects, source: "supabase" });
}
