import { getSupabaseAdmin } from "./supabase";

export const PRL_BUCKET = "prl-documents";

export const requiredCompanyDocuments = [
  "CIF",
  "Seguro responsabilidad civil",
  "Certificado AEAT",
  "Certificado Seguridad Social",
  "Servicio de prevención",
  "Evaluación de riesgos",
  "Planificación preventiva",
  "Adhesión al Plan de Seguridad y Salud"
];

export function prlToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function appBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/g, "") || new URL(request.url).origin;
}

export async function ensurePrlBucket() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { data } = await supabase.storage.getBucket(PRL_BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(PRL_BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024 * 25
  });
  if (error && !error.message.toLowerCase().includes("already exists")) throw error;
}

export async function signedUrl(filePath: string | null) {
  if (!filePath) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase.storage.from(PRL_BUCKET).createSignedUrl(filePath, 60 * 10);
  return data?.signedUrl ?? null;
}
