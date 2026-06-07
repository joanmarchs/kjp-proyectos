import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { appBaseUrl, prlMailFrom, prlToken, sendPrlInvitationEmail } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type PrlInvitationRow = {
  id: string;
  token: string;
  project_name: string;
  company_name: string;
  company_email: string;
};

async function updateEmailStatus(
  supabase: SupabaseAdmin,
  id: string,
  patch: { email_sent_at?: string | null; email_error?: string | null }
) {
  const { error } = await supabase.from("prl_invitations").update(patch).eq("id", id);
  if (error && !error.message.toLowerCase().includes("email")) throw error;
}

async function sendInvitationAndMark({
  supabase,
  request,
  invitation
}: {
  supabase: SupabaseAdmin;
  request: Request;
  invitation: PrlInvitationRow;
}) {
  const inviteUrl = `${appBaseUrl(request)}/prl/acceso/${invitation.token}`;
  try {
    await sendPrlInvitationEmail({
      to: invitation.company_email,
      companyName: invitation.company_name,
      projectName: invitation.project_name,
      inviteUrl
    });
    const emailSentAt = new Date().toISOString();
    await updateEmailStatus(supabase, invitation.id, { email_sent_at: emailSentAt, email_error: null });
    return { inviteUrl, emailSent: true, emailSentAt, emailError: null, mailFrom: prlMailFrom() };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "No se pudo enviar el email.";
    await updateEmailStatus(supabase, invitation.id, { email_sent_at: null, email_error: emailError }).catch(() => undefined);
    return { inviteUrl, emailSent: false, emailSentAt: null, emailError, mailFrom: prlMailFrom() };
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as {
    projectId?: string;
    projectName?: string;
    companyName?: string;
    companyEmail?: string;
    companyCif?: string;
    contactName?: string;
    role?: string;
    parentInvitationId?: string | null;
  };
  const projectId = body.projectId?.trim() ?? "";
  const projectName = body.projectName?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const companyEmail = body.companyEmail?.trim().toLowerCase() ?? "";

  if (!projectId || !projectName || !companyName || !companyEmail) {
    return NextResponse.json({ error: "Faltan datos obligatorios de invitacion." }, { status: 400 });
  }

  const contractorResult = await supabase.from("prl_contractors").select("id").eq("email", companyEmail).maybeSingle();
  if (contractorResult.error) {
    return NextResponse.json({ error: contractorResult.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("prl_invitations")
    .insert({
      project_id: projectId,
      project_name: projectName,
      company_name: companyName,
      company_email: companyEmail,
      company_cif: body.companyCif?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      role: body.role?.trim() || null,
      parent_invitation_id: body.parentInvitationId?.trim() || null,
      contractor_id: contractorResult.data?.id ?? null,
      token: prlToken()
    })
    .select("*")
    .single();

  if (error) {
    const message = error.message.toLowerCase().includes("parent_invitation_id")
      ? "Falta aplicar en Supabase la columna parent_invitation_id para guardar subcontratas."
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const email = await sendInvitationAndMark({ supabase, request, invitation: data });
  return NextResponse.json({ invitation: data, ...email });
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as {
    id?: string;
    companyName?: string;
    companyEmail?: string;
    companyCif?: string;
    contactName?: string;
    role?: string;
    parentInvitationId?: string | null;
  };
  const id = body.id?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const companyEmail = body.companyEmail?.trim().toLowerCase() ?? "";

  if (!id || !companyName || !companyEmail) {
    return NextResponse.json({ error: "Faltan datos obligatorios para editar la invitacion." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prl_invitations")
    .update({
      company_name: companyName,
      company_email: companyEmail,
      company_cif: body.companyCif?.trim() || null,
      contact_name: body.contactName?.trim() || null,
      role: body.role?.trim() || null,
      parent_invitation_id: body.parentInvitationId?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    const message = error.message.toLowerCase().includes("parent_invitation_id")
      ? "Falta aplicar en Supabase la columna parent_invitation_id para guardar subcontratas."
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ invitation: data });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as { id?: string };
  const id = body.id?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Falta el id de invitacion." }, { status: 400 });

  const { error } = await supabase.from("prl_invitations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
