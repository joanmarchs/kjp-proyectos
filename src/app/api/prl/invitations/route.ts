import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { appBaseUrl, prlToken, requiredCompanyDocuments } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const body = (await request.json()) as {
    projectId?: string;
    projectName?: string;
    companyName?: string;
    companyEmail?: string;
    companyCif?: string;
    contactName?: string;
    role?: string;
  };
  const projectId = body.projectId?.trim() ?? "";
  const projectName = body.projectName?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const companyEmail = body.companyEmail?.trim().toLowerCase() ?? "";

  if (!projectId || !projectName || !companyName || !companyEmail) {
    return NextResponse.json({ error: "Faltan datos obligatorios de invitación." }, { status: 400 });
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
      token: prlToken()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inviteUrl = `${appBaseUrl(request)}/prl/acceso/${data.token}`;
  const subject = encodeURIComponent(`Documentación PRL - ${projectName}`);
  const text = [
    `Hola,`,
    ``,
    `KJP te invita a subir la documentación PRL/CAE para la obra: ${projectName}.`,
    ``,
    `Accede desde este enlace:`,
    inviteUrl,
    ``,
    `Documentación inicial requerida:`,
    ...requiredCompanyDocuments.map((item) => `- ${item}`),
    ``,
    `Gracias.`
  ].join("\n");
  const mailto = `mailto:${companyEmail}?subject=${subject}&body=${encodeURIComponent(text)}`;

  return NextResponse.json({ invitation: data, inviteUrl, mailto });
}
