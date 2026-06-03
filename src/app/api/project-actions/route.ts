import { NextResponse } from "next/server";
import { deleteHoldedProject, updateHoldedProject } from "@/lib/holded";
import { isAuthenticated } from "@/lib/auth";
import { deleteProjectFolder, moveProjectFolder } from "@/lib/project-folders";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function projectStatus(value: unknown): ProjectStatus | null {
  return value === "pendiente_adjudicar" ||
    value === "desestimado" ||
    value === "fase_estudio" ||
    value === "fase_obra" ||
    value === "pendiente_facturar" ||
    value === "facturado"
    ? value
    : null;
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string; name?: string; startDate?: string | null };
    const project = await updateHoldedProject({
      id: body.id ?? "",
      name: body.name ?? "",
      startDate: body.startDate ?? null
    });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: current } = await supabase.from("project_costs_2026").select("raw").eq("id", project.id).maybeSingle();
      const currentRaw = current?.raw && typeof current.raw === "object" ? (current.raw as { status?: ProjectStatus }) : {};
      const raw = { ...project, status: projectStatus(currentRaw.status) ?? "fase_estudio" };

      let { error } = await supabase
        .from("project_costs_2026")
        .update({ name: project.name, start_date: project.startDate, raw, synced_at: new Date().toISOString() })
        .eq("id", project.id);

      if (error && error.message.includes("start_date")) {
        const fallback = await supabase
          .from("project_costs_2026")
          .update({ name: project.name, raw, synced_at: new Date().toISOString() })
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

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string; name?: string; status?: string };
    const id = body.id ?? "";
    const name = body.name?.trim() ?? "";
    const status = projectStatus(body.status);

    if (!id) return NextResponse.json({ error: "Falta el ID del proyecto." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Falta el nombre del proyecto." }, { status: 400 });
    if (!status) return NextResponse.json({ error: "Estado de proyecto no valido." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    if (supabase) {
      const { data: current, error: readError } = await supabase.from("project_costs_2026").select("raw").eq("id", id).maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

      const raw = current?.raw && typeof current.raw === "object" ? current.raw : {};
      const { error } = await supabase
        .from("project_costs_2026")
        .update({ raw: { ...raw, status }, synced_at: new Date().toISOString() })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const folder = await moveProjectFolder(name, status);
      const folderMissing = !folder.moved && "reason" in folder && folder.reason === "La carpeta no existia.";
      return NextResponse.json({ status, folder, folderMissing, statusUpdated: true });
    } catch (error) {
      return NextResponse.json({
        status,
        statusUpdated: true,
        folderError: error instanceof Error ? error.message : "No se pudo mover la carpeta en OneDrive."
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cambiar el estado del proyecto." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

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
