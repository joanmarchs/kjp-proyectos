import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { appBaseUrl, prlMailFrom, sendPrlInvitationEmail } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { invitationId } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("id", invitationId).single();
  if (error || !invitation) return NextResponse.json({ error: error?.message ?? "Invitacion no encontrada." }, { status: 404 });

  const inviteUrl = `${appBaseUrl(request)}/prl/acceso/${invitation.token}`;

  try {
    await sendPrlInvitationEmail({
      to: invitation.company_email,
      companyName: invitation.company_name,
      projectName: invitation.project_name,
      inviteUrl
    });
    const emailSentAt = new Date().toISOString();
    await supabase
      .from("prl_invitations")
      .update({ email_sent_at: emailSentAt, email_error: null, updated_at: emailSentAt })
      .eq("id", invitation.id);
    return NextResponse.json({ ok: true, inviteUrl, emailSent: true, emailSentAt, emailError: null, mailFrom: prlMailFrom() });
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "No se pudo reenviar el email.";
    await supabase
      .from("prl_invitations")
      .update({ email_error: emailError, updated_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .then(() => undefined, () => undefined);
    return NextResponse.json({ ok: false, inviteUrl, emailSent: false, emailError, mailFrom: prlMailFrom() }, { status: 502 });
  }
}
