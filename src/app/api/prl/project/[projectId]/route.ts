import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { signedUrl } from "@/lib/prl";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const { projectId } = await params;
  const [invitationsResult, documentsResult] = await Promise.all([
    supabase.from("prl_invitations").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("prl_documents").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false })
  ]);

  if (invitationsResult.error) return NextResponse.json({ error: invitationsResult.error.message }, { status: 500 });
  if (documentsResult.error) return NextResponse.json({ error: documentsResult.error.message }, { status: 500 });

  const documents = await Promise.all(
    (documentsResult.data ?? []).map(async (document) => ({ ...document, signed_url: await signedUrl(document.file_path) }))
  );

  return NextResponse.json({ invitations: invitationsResult.data ?? [], documents });
}
