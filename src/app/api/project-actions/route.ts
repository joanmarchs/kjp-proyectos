import { NextResponse } from "next/server";
import { createHoldedProject, deleteHoldedProject, updateHoldedProject } from "@/lib/holded";
import { isAuthenticated } from "@/lib/auth";
import { deleteProjectFolder, moveProjectFolder } from "@/lib/project-folders";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type StoredProjectRaw = {
  status?: ProjectStatus;
  holded_id?: string | null;
  local_project?: boolean;
  [key: string]: unknown;
};

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

function storedRaw(value: unknown): StoredProjectRaw {
  return value && typeof value === "object" ? (value as StoredProjectRaw) : {};
}

function holdedProjectId(rowId: string, raw: StoredProjectRaw) {
  if (typeof raw.holded_id === "string" && raw.holded_id) return raw.holded_id;
  return raw.local_project ? null : rowId;
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string; name?: string; startDate?: string | null };
    const id = body.id ?? "";
    const name = body.name?.trim() ?? "";
    if (!id || !name) return NextResponse.json({ error: "Faltan datos del proyecto." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

    const { data: current, error: readError } = await supabase
      .from("project_costs_2026")
      .select("raw")
      .eq("id", id)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

    const currentRaw = storedRaw(current?.raw);
    const holdedId = holdedProjectId(id, currentRaw);
    const holdedProject = holdedId
      ? await updateHoldedProject({ id: holdedId, name, startDate: body.startDate ?? null })
      : null;
    const project = { id, name, startDate: body.startDate ?? null };
    const raw = {
      ...currentRaw,
      ...(holdedProject ?? project),
      id,
      holded_id: holdedId,
      status: projectStatus(currentRaw.status) ?? "fase_estudio"
    };

    let { error } = await supabase
      .from("project_costs_2026")
      .update({ name, start_date: project.startDate, raw, synced_at: new Date().toISOString() })
      .eq("id", id);

    if (error && error.message.includes("start_date")) {
      const fallback = await supabase
        .from("project_costs_2026")
        .update({ name, raw, synced_at: new Date().toISOString() })
        .eq("id", id);
      error = fallback.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
      const { data: current, error: readError } = await supabase
        .from("project_costs_2026")
        .select("name,start_date,raw")
        .eq("id", id)
        .maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

      const currentRaw = storedRaw(current?.raw);
      let holdedCreated = false;
      let createdHoldedProject: Awaited<ReturnType<typeof createHoldedProject>> | null = null;

      if (status === "fase_obra" && !holdedProjectId(id, currentRaw)) {
        createdHoldedProject = await createHoldedProject({
          name: current?.name ?? name,
          startDate: current?.start_date ?? null
        });
        holdedCreated = true;
      }

      const holdedId = createdHoldedProject?.id ?? holdedProjectId(id, currentRaw);
      const raw = {
        ...currentRaw,
        ...(createdHoldedProject ?? {}),
        id,
        status,
        holded_id: holdedId,
        local_project: currentRaw.local_project ?? id.startsWith("local-"),
        ...(holdedCreated ? { holded_created_at: new Date().toISOString() } : {})
      };
      const { error } = await supabase
        .from("project_costs_2026")
        .update({ raw, synced_at: new Date().toISOString() })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      try {
        const folder = await moveProjectFolder(name, status);
        const folderMissing = !folder.moved && "reason" in folder && folder.reason === "La carpeta no existia.";
        return NextResponse.json({
          status,
          folder,
          folderMissing,
          statusUpdated: true,
          holdedCreated,
          holdedProject: createdHoldedProject
        });
      } catch (error) {
        return NextResponse.json({
          status,
          statusUpdated: true,
          holdedCreated,
          holdedProject: createdHoldedProject,
          folderError: error instanceof Error ? error.message : "No se pudo mover la carpeta en OneDrive."
        });
      }
    }

    return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });
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
    const supabase = getSupabaseAdmin();
    let raw: StoredProjectRaw = {};
    if (supabase) {
      const { data: current, error: readError } = await supabase
        .from("project_costs_2026")
        .select("raw")
        .eq("id", id)
        .maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
      raw = storedRaw(current?.raw);
    }

    const holdedId = holdedProjectId(id, raw);
    if (holdedId) await deleteHoldedProject(holdedId);
    const folder = name ? await deleteProjectFolder(name) : null;

    if (supabase) {
      const { error } = await supabase.from("project_costs_2026").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true, folder });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el proyecto." }, { status: 500 });
  }
}
