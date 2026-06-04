import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { signedUrl } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isMissingRelation(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || error?.message?.toLowerCase().includes("could not find the table");
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { projectId } = await params;
  const invitationsResult = await supabase.from("prl_invitations").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (invitationsResult.error) return NextResponse.json({ error: invitationsResult.error.message }, { status: 500 });

  const documentsResult = await supabase.from("prl_documents").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false });
  if (documentsResult.error) return NextResponse.json({ error: documentsResult.error.message }, { status: 500 });

  const workersResult = await supabase.from("prl_workers").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (workersResult.error && !isMissingRelation(workersResult.error)) {
    return NextResponse.json({ error: workersResult.error.message }, { status: 500 });
  }

  const contractorsResult = await supabase.from("prl_contractors").select("id,email,company_name,company_cif,contact_name,contractor_type");
  const contractors = contractorsResult.error && isMissingRelation(contractorsResult.error) ? [] : contractorsResult.data ?? [];

  const documents = await Promise.all(
    (documentsResult.data ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) }))
  );

  return NextResponse.json({
    invitations: invitationsResult.data ?? [],
    documents,
    workers: workersResult.error ? [] : workersResult.data ?? [],
    contractors
  });
}
