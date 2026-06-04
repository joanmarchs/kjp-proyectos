import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PRL_CONTRACTOR_COOKIE,
  requiredCompanyDocuments,
  requiredWorkerDocuments,
  signedUrl,
  verifyPrlContractorSession
} from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { token } = await params;
  const { data: invitation, error } = await supabase.from("prl_invitations").select("*").eq("token", token).single();
  if (error || !invitation) return NextResponse.json({ error: "Invitacion no valida." }, { status: 404 });

  const contractorSession = verifyPrlContractorSession((await cookies()).get(PRL_CONTRACTOR_COOKIE)?.value);
  const authenticated = Boolean(contractorSession) && contractorSession?.email === invitation.company_email.trim().toLowerCase();
  if (!authenticated) {
    return NextResponse.json({
      invitation,
      contractor: null,
      workers: [],
      documents: [],
      requiredCompanyDocuments: [],
      requiredWorkerDocuments: [],
      authenticated: false
    });
  }
  const contractorId = contractorSession!.id;

  const [contractorResult, workersResult, documentsResult] = await Promise.all([
    supabase.from("prl_contractors").select("*").eq("id", contractorId).single(),
    supabase
      .from("prl_workers")
      .select("*")
      .eq("invitation_id", invitation.id)
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: true }),
    supabase.from("prl_documents").select("*").eq("invitation_id", invitation.id).order("uploaded_at", { ascending: false })
  ]);

  if (contractorResult.error) return NextResponse.json({ error: contractorResult.error.message }, { status: 500 });
  if (workersResult.error) return NextResponse.json({ error: workersResult.error.message }, { status: 500 });
  if (documentsResult.error) return NextResponse.json({ error: documentsResult.error.message }, { status: 500 });

  const docsWithUrls = await Promise.all(
    (documentsResult.data ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) }))
  );

  return NextResponse.json({
    invitation,
    contractor: contractorResult.data,
    workers: workersResult.data ?? [],
    documents: docsWithUrls,
    requiredCompanyDocuments,
    requiredWorkerDocuments,
    authenticated: true
  });
}
