import { NextResponse } from "next/server";
import {
  createPrlContractorSession,
  hashPrlPassword,
  normalizePrlEmail,
  PRL_CONTRACTOR_COOKIE,
  verifyPrlPassword
} from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitacion no valida." }, { status: 404 });

  const body = (await request.json()) as { mode?: "login" | "register"; email?: string; password?: string; contactName?: string };
  const mode = body.mode === "login" ? "login" : "register";
  const email = normalizePrlEmail(body.email ?? "");
  const password = body.password ?? "";

  if (!email || email !== normalizePrlEmail(invitation.company_email)) {
    return NextResponse.json({ error: "Debes acceder con el email que recibio la invitacion." }, { status: 403 });
  }

  if (password.length < 8) return NextResponse.json({ error: "La contrasena debe tener al menos 8 caracteres." }, { status: 400 });

  const existing = await supabase.from("prl_contractors").select("*").eq("email", email).maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });

  let contractor = existing.data;
  if (contractor) {
    if (!verifyPrlPassword(password, contractor.password_hash)) {
      return NextResponse.json({ error: mode === "register" ? "Este email ya esta registrado. Entra con tu contrasena." : "Contrasena incorrecta." }, { status: 401 });
    }
  } else {
    if (mode === "login") return NextResponse.json({ error: "No existe una cuenta con este email. Crea tu acceso primero." }, { status: 404 });

    const created = await supabase
      .from("prl_contractors")
      .insert({
        email,
        password_hash: hashPrlPassword(password),
        company_name: invitation.company_name,
        company_cif: invitation.company_cif,
        contact_name: body.contactName?.trim() || invitation.contact_name
      })
      .select("*")
      .single();
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
    contractor = created.data;
  }

  const now = new Date().toISOString();
  await supabase.from("prl_contractors").update({ last_login_at: now, updated_at: now }).eq("id", contractor.id);
  await supabase
    .from("prl_invitations")
    .update({ contractor_id: contractor.id, accepted_at: now, updated_at: now })
    .eq("id", invitation.id);

  const response = NextResponse.json({ ok: true, contractor: { id: contractor.id, email: contractor.email } });
  response.cookies.set(PRL_CONTRACTOR_COOKIE, createPrlContractorSession({ id: contractor.id, email: contractor.email }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
