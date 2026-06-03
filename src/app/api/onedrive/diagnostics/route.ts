import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { graphDiagnostics } from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await graphDiagnostics());
  } catch (error) {
    return NextResponse.json(
      { configured: false, error: error instanceof Error ? error.message : "Error de Microsoft Graph." },
      { status: 500 }
    );
  }
}
