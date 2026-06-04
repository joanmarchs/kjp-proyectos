import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as {
    projectId?: string;
    invitationId?: string;
    contractorId?: string | null;
    fullName?: string;
    dni?: string;
    position?: string;
  };
  const projectId = body.projectId?.trim() ?? "";
  const invitationId = body.invitationId?.trim() || null;
  const fullName = body.fullName?.trim() ?? "";

  if (!projectId || !fullName) {
    return NextResponse.json({ error: "Faltan datos obligatorios del trabajador." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prl_workers")
    .insert({
      project_id: projectId,
      invitation_id: invitationId,
      contractor_id: body.contractorId?.trim() || null,
      full_name: fullName,
      dni: body.dni?.trim() || null,
      position: body.position?.trim() || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ worker: data }, { status: 201 });
}
