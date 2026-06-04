import { getSupabaseAdmin } from "./supabase";

export const PRL_BUCKET = "prl-documents";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

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

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en las variables de entorno.`);
  return value;
}

async function getGraphAccessToken() {
  const body = new URLSearchParams({
    client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requiredEnv("MICROSOFT_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(`https://login.microsoftonline.com/${requiredEnv("MICROSOFT_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`Microsoft token ${response.status}: ${(await response.text()).slice(0, 300)}`);

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Microsoft no devolvio access_token.");
  return payload.access_token;
}

export function prlMailFrom() {
  return process.env.PRL_MAIL_FROM?.trim() || "PRL@kjpretail.com";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function prlInvitationEmailHtml({
  projectName,
  companyName,
  inviteUrl
}: {
  projectName: string;
  companyName: string;
  inviteUrl: string;
}) {
  const documentItems = requiredCompanyDocuments.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <div style="margin:0;padding:0;background:#f4f7f1;font-family:Arial,Helvetica,sans-serif;color:#172017;">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#ffffff;border:1px solid #d7e1d0;border-radius:12px;overflow:hidden;">
          <div style="padding:22px 26px;background:#162015;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:4px;color:#b9f56e;font-weight:700;">KJP PRL</div>
            <h1 style="margin:14px 0 0;font-size:26px;line-height:1.15;">Documentacion PRL requerida</h1>
          </div>
          <div style="padding:26px;">
            <p style="font-size:16px;line-height:1.55;margin:0 0 16px;">Hola ${escapeHtml(companyName)},</p>
            <p style="font-size:16px;line-height:1.55;margin:0 0 16px;">
              KJP te invita a formar parte de la obra <strong>${escapeHtml(projectName)}</strong>. Para poder acceder a obra necesitamos que subas la documentacion PRL/CAE correspondiente.
            </p>
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;margin:10px 0 22px;padding:13px 20px;background:#4e8f76;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:800;">
              Acceder al portal PRL
            </a>
            <p style="font-size:14px;line-height:1.5;margin:0 0 10px;color:#50604c;">Documentacion inicial requerida:</p>
            <ul style="font-size:14px;line-height:1.7;margin:0 0 22px;padding-left:20px;color:#172017;">${documentItems}</ul>
            <p style="font-size:13px;line-height:1.45;margin:0;color:#64705f;">
              Si el boton no funciona, copia este enlace en el navegador:<br />
              <a href="${escapeHtml(inviteUrl)}" style="color:#4e8f76;">${escapeHtml(inviteUrl)}</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;
}

export async function sendPrlInvitationEmail({
  to,
  companyName,
  projectName,
  inviteUrl
}: {
  to: string;
  companyName: string;
  projectName: string;
  inviteUrl: string;
}) {
  const from = prlMailFrom();
  const response = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await getGraphAccessToken()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      message: {
        subject: `Documentacion PRL - ${projectName}`,
        body: {
          contentType: "HTML",
          content: prlInvitationEmailHtml({ projectName, companyName, inviteUrl })
        },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: true
    }),
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`Microsoft Graph Mail ${response.status}: ${(await response.text()).slice(0, 500)}`);
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
