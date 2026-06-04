import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const { documentId } = await params;
  const body = (await request.json()) as { status?: "aprobado" | "rechazado"; rejectionComment?: string; internalComment?: string };

  if (body.status !== "aprobado" && body.status !== "rechazado") {
    return NextResponse.json({ error: "Estado de revisión no válido." }, { status: 400 });
  }

  if (body.status === "rechazado" && !body.rejectionComment?.trim()) {
    return NextResponse.json({ error: "El comentario de rechazo es obligatorio." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prl_documents")
    .update({
      status: body.status,
      reviewed_by: "KJP",
      reviewed_at: new Date().toISOString(),
      rejection_comment: body.status === "rechazado" ? body.rejectionComment?.trim() : null,
      internal_comment: body.internalComment?.trim() || null
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
