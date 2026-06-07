import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as {
    key?: string;
    contractorId?: string | null;
    companyName?: string;
    companyEmail?: string;
    companyCif?: string;
    contactName?: string;
    contractorType?: string;
  };
  const key = body.key?.trim().toLowerCase() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const companyEmail = body.companyEmail?.trim().toLowerCase() ?? "";

  if (!key || !companyName || !companyEmail) {
    return NextResponse.json({ error: "Faltan datos obligatorios de la empresa." }, { status: 400 });
  }

  const invitationPatch = {
    company_name: companyName,
    company_email: companyEmail,
    company_cif: body.companyCif?.trim() || null,
    contact_name: body.contactName?.trim() || null,
    updated_at: new Date().toISOString()
  };

  const invitationQuery = supabase.from("prl_invitations").update(invitationPatch);
  const invitationResult = key.includes("@")
    ? await invitationQuery.eq("company_email", key)
    : await invitationQuery.eq("company_cif", key);

  if (invitationResult.error) {
    return NextResponse.json({ error: invitationResult.error.message }, { status: 500 });
  }

  if (body.contractorId) {
    const contractorResult = await supabase
      .from("prl_contractors")
      .update({
        email: companyEmail,
        company_name: companyName,
        company_cif: body.companyCif?.trim() || null,
        contact_name: body.contactName?.trim() || null,
        contractor_type: body.contractorType?.trim() || "empresa",
        updated_at: new Date().toISOString()
      })
      .eq("id", body.contractorId);

    if (contractorResult.error) {
      return NextResponse.json({ error: contractorResult.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const body = (await request.json()) as {
    companyKey?: string;
    contractorId?: string | null;
    fullName?: string;
    dni?: string;
    position?: string;
  };
  const companyKey = body.companyKey?.trim().toLowerCase() ?? "";
  const fullName = body.fullName?.trim() ?? "";

  if (!companyKey || !fullName) {
    return NextResponse.json({ error: "Faltan la empresa o el nombre del trabajador." }, { status: 400 });
  }

  let invitationId: string | null = null;
  let projectId = "__directory__";

  if (!body.contractorId) {
    const invitationQuery = supabase
      .from("prl_invitations")
      .select("id,project_id")
      .order("updated_at", { ascending: false })
      .limit(1);
    const invitationResult = companyKey.includes("@")
      ? await invitationQuery.eq("company_email", companyKey).maybeSingle()
      : await invitationQuery.eq("company_cif", companyKey).maybeSingle();

    if (invitationResult.error) {
      return NextResponse.json({ error: invitationResult.error.message }, { status: 500 });
    }
    invitationId = invitationResult.data?.id ?? null;
    projectId = invitationResult.data?.project_id ?? "__directory__";
  }

  const { data, error } = await supabase
    .from("prl_workers")
    .insert({
      project_id: projectId,
      invitation_id: invitationId,
      contractor_id: body.contractorId?.trim() || null,
      full_name: fullName,
      dni: body.dni?.trim() || null,
      position: body.position?.trim() || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ worker: data }, { status: 201 });
}
