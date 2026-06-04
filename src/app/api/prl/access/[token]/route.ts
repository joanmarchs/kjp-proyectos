import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PRL_CONTRACTOR_COOKIE, requiredCompanyDocuments, signedUrl, verifyPrlContractorSession } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitacion no valida." }, { status: 404 });

  const contractorSession = verifyPrlContractorSession((await cookies()).get(PRL_CONTRACTOR_COOKIE)?.value);
  const authenticated = contractorSession?.email === invitation.company_email.trim().toLowerCase();
  if (!authenticated) return NextResponse.json({ invitation, documents: [], requiredDocuments: [], authenticated: false });

  const { data: documents, error: documentsError } = await supabase
    .from("prl_documents")
    .select("*")
    .eq("invitation_id", invitation.id)
    .order("uploaded_at", { ascending: false });

  if (documentsError) return NextResponse.json({ error: documentsError.message }, { status: 500 });

  const docsWithUrls = await Promise.all((documents ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) })));

  return NextResponse.json({ invitation, documents: docsWithUrls, requiredDocuments: requiredCompanyDocuments, authenticated: true });
}
