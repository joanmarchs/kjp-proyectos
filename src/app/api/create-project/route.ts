import { NextResponse } from "next/server";
import { createHoldedProject } from "@/lib/holded";
import { assertProjectFolderCanBeCreated, copyProjectTemplate } from "@/lib/project-folders";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; startDate?: string | null };
    const name = body.name?.trim() ?? "";

    if (!name) {
      return NextResponse.json({ error: "El nombre del proyecto es obligatorio." }, { status: 400 });
    }

    await assertProjectFolderCanBeCreated(name);
    const project = await createHoldedProject({ name, startDate: body.startDate ?? null });
    const folder = await copyProjectTemplate(project.name);
    const supabase = getSupabaseAdmin();

    if (supabase && project.id) {
      const row = {
        id: project.id,
        name: project.name,
        start_date: project.startDate,
        cost: 0,
        sales: 0,
        profit: 0,
        suppliers: [],
        categories: [],
        raw: project,
        synced_at: new Date().toISOString()
      };
      let { error } = await supabase.from("project_costs_2026").upsert(row, { onConflict: "id" });
      if (error && error.message.includes("start_date")) {
        const { start_date, ...fallbackRow } = row;
        const fallback = await supabase.from("project_costs_2026").upsert(fallbackRow, { onConflict: "id" });
        error = fallback.error;
      }
      if (error) {
        return NextResponse.json({ project, persisted: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ project, folder, persisted: Boolean(supabase) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el proyecto." },
      { status: 500 }
    );
  }
}
