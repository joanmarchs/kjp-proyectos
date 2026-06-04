import { NextResponse } from "next/server";
import { requiredCompanyDocuments, signedUrl } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });

  const { data: documents, error: documentsError } = await supabase
    .from("prl_documents")
    .select("*")
    .eq("invitation_id", invitation.id)
    .order("uploaded_at", { ascending: false });

  if (documentsError) return NextResponse.json({ error: documentsError.message }, { status: 500 });

  const docsWithUrls = await Promise.all((documents ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) })));

  return NextResponse.json({ invitation, documents: docsWithUrls, requiredDocuments: requiredCompanyDocuments });
}
