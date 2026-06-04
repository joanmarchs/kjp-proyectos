import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PRL_CONTRACTOR_COOKIE, verifyPrlContractorSession } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitacion no valida." }, { status: 404 });

  const contractorSession = verifyPrlContractorSession((await cookies()).get(PRL_CONTRACTOR_COOKIE)?.value);
  if (!contractorSession || contractorSession.email !== invitation.company_email.trim().toLowerCase()) {
    return NextResponse.json({ error: "Inicia sesion antes de editar el perfil." }, { status: 401 });
  }

  const body = (await request.json()) as {
    contractorType?: string;
    companyName?: string;
    companyCif?: string;
    contactName?: string;
  };
  const contractorType = body.contractorType === "autonomo" ? "autonomo" : "empresa";
  const companyName = body.companyName?.trim() || invitation.company_name;

  const { data, error: updateError } = await supabase
    .from("prl_contractors")
    .update({
      contractor_type: contractorType,
      company_name: companyName,
      company_cif: body.companyCif?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", contractorSession.id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase
    .from("prl_invitations")
    .update({
      company_name: companyName,
      company_cif: body.companyCif?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", invitation.id);

  return NextResponse.json({ contractor: data });
}
