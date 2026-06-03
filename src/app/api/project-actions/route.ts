import { NextResponse } from "next/server";
import { deleteHoldedProject, updateHoldedProject } from "@/lib/holded";
import { deleteProjectFolder } from "@/lib/project-folders";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; name?: string; startDate?: string | null };
    const project = await updateHoldedProject({
      id: body.id ?? "",
      name: body.name ?? "",
      startDate: body.startDate ?? null
    });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      let { error } = await supabase
        .from("project_costs_2026")
        .update({ name: project.name, start_date: project.startDate, raw: project, synced_at: new Date().toISOString() })
        .eq("id", project.id);

      if (error && error.message.includes("start_date")) {
        const fallback = await supabase
          .from("project_costs_2026")
          .update({ name: project.name, raw: project, synced_at: new Date().toISOString() })
          .eq("id", project.id);
        error = fallback.error;
      }

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo editar el proyecto." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; name?: string };
    const id = body.id ?? "";
    const name = body.name?.trim() ?? "";
    await deleteHoldedProject(id);
    const folder = name ? await deleteProjectFolder(name) : null;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("project_costs_2026").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true, folder });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el proyecto." }, { status: 500 });
  }
}
