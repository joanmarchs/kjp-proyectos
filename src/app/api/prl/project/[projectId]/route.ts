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

  const directoryInvitationsResult = await supabase
    .from("prl_invitations")
    .select("company_name,company_email,company_cif,contact_name,contractor_id,updated_at")
    .order("updated_at", { ascending: false });

  if (directoryInvitationsResult.error) {
    return NextResponse.json({ error: directoryInvitationsResult.error.message }, { status: 500 });
  }

  const companyDirectory = new Map<
    string,
    {
      key: string;
      company_name: string;
      company_email: string;
      company_cif: string | null;
      contact_name: string | null;
      contractor_id: string | null;
      contractor_type: string | null;
    }
  >();

  for (const invitation of directoryInvitationsResult.data ?? []) {
    const key = invitation.company_cif?.trim().toLowerCase() || invitation.company_email.trim().toLowerCase();
    if (!companyDirectory.has(key)) {
      companyDirectory.set(key, {
        key,
        company_name: invitation.company_name,
        company_email: invitation.company_email,
        company_cif: invitation.company_cif,
        contact_name: invitation.contact_name,
        contractor_id: invitation.contractor_id,
        contractor_type: null
      });
    }
  }

  for (const contractor of contractors) {
    const key = contractor.company_cif?.trim().toLowerCase() || contractor.email.trim().toLowerCase();
    const existing = companyDirectory.get(key);
    companyDirectory.set(key, {
      key,
      company_name: contractor.company_name || existing?.company_name || "",
      company_email: contractor.email || existing?.company_email || "",
      company_cif: contractor.company_cif || existing?.company_cif || null,
      contact_name: contractor.contact_name || existing?.contact_name || null,
      contractor_id: contractor.id,
      contractor_type: contractor.contractor_type
    });
  }

  const documents = await Promise.all(
    (documentsResult.data ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) }))
  );

  return NextResponse.json({
    invitations: invitationsResult.data ?? [],
    documents,
    workers: workersResult.error ? [] : workersResult.data ?? [],
    contractors,
    companyDirectory: Array.from(companyDirectory.values()).sort((a, b) => a.company_name.localeCompare(b.company_name, "es"))
  });
}
