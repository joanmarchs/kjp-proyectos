import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensurePrlBucket, PRL_BUCKET, PRL_CONTRACTOR_COOKIE, verifyPrlContractorSession } from "@/lib/prl";
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
    return NextResponse.json({ error: "Inicia sesion con el email invitado antes de subir documentacion." }, { status: 401 });
  }
  const contractorId = contractorSession.id;

  const form = await request.formData();
  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim();
  const ownerType = String(form.get("ownerType") ?? "company") === "worker" ? "worker" : "company";
  const workerId = String(form.get("workerId") ?? "").trim();
  const issueDate = String(form.get("issueDate") ?? "").trim() || null;
  const expiryDate = String(form.get("expiryDate") ?? "").trim() || null;

  if (!documentType) return NextResponse.json({ error: "Selecciona un tipo de documento." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Adjunta un archivo." }, { status: 400 });

  let ownerId: string | null = null;
  let ownerName = invitation.company_name;
  if (ownerType === "worker") {
    if (!workerId) return NextResponse.json({ error: "Selecciona un trabajador." }, { status: 400 });
    const worker = await supabase
      .from("prl_workers")
      .select("*")
      .eq("id", workerId)
      .eq("invitation_id", invitation.id)
      .eq("contractor_id", contractorId)
      .single();
    if (worker.error || !worker.data) return NextResponse.json({ error: "Trabajador no valido." }, { status: 404 });
    ownerId = worker.data.id;
    ownerName = worker.data.full_name;
  }

  await ensurePrlBucket();

  const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
  const filePath = `${invitation.project_id}/${invitation.id}/${ownerType}/${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage.from(PRL_BUCKET).upload(filePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data, error: insertError } = await supabase
    .from("prl_documents")
    .insert({
      project_id: invitation.project_id,
      invitation_id: invitation.id,
      company_name: invitation.company_name,
      company_email: invitation.company_email,
      document_type: documentType,
      category: ownerType === "worker" ? "trabajador" : "empresa",
      owner_type: ownerType,
      owner_id: ownerId,
      owner_name: ownerName,
      file_name: file.name,
      file_path: filePath,
      status: "revision",
      issue_date: issueDate,
      expiry_date: expiryDate
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("prl_invitations").update({ status: "documents_uploaded", updated_at: new Date().toISOString() }).eq("id", invitation.id);

  return NextResponse.json({ document: data }, { status: 201 });
}
