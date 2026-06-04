import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PRL_CONTRACTOR_COOKIE, verifyPrlContractorSession } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitacion no valida." }, { status: 404 });

  const contractorSession = verifyPrlContractorSession((await cookies()).get(PRL_CONTRACTOR_COOKIE)?.value);
  if (!contractorSession || contractorSession.email !== invitation.company_email.trim().toLowerCase()) {
    return NextResponse.json({ error: "Inicia sesion antes de anadir trabajadores." }, { status: 401 });
  }

  const body = (await request.json()) as { fullName?: string; dni?: string; position?: string };
  const fullName = body.fullName?.trim() ?? "";
  if (!fullName) return NextResponse.json({ error: "Indica el nombre del trabajador." }, { status: 400 });

  const { data, error: insertError } = await supabase
    .from("prl_workers")
    .insert({
      contractor_id: contractorSession.id,
      invitation_id: invitation.id,
      project_id: invitation.project_id,
      full_name: fullName,
      dni: body.dni?.trim() || null,
      position: body.position?.trim() || null
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ worker: data }, { status: 201 });
}
