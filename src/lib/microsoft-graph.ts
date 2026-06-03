type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  folder?: unknown;
};

type GraphChildrenResponse = {
  value: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

export type ProjectFolderStatus = "fase_estudio" | "pendiente_adjudicar" | "desestimado";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const STATUS_FOLDER_NAMES: Record<ProjectFolderStatus, string | null> = {
  fase_estudio: null,
  pendiente_adjudicar: "Z_PENDIENTE DE ADJUDICAR",
  desestimado: "X_DESESTIMADOS"
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en las variables de entorno.`);
  return value;
}

function sanitizeGraphFolderName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export function isMicrosoftGraphConfigured() {
  return Boolean(
    process.env.MICROSOFT_TENANT_ID &&
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MS_GRAPH_DRIVE_ID &&
      process.env.MS_GRAPH_STUDIES_FOLDER_ID &&
      process.env.MS_GRAPH_TEMPLATE_FOLDER_ID
  );
}

function graphMissingEnv() {
  return [
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MS_GRAPH_DRIVE_ID",
    "MS_GRAPH_STUDIES_FOLDER_ID",
    "MS_GRAPH_TEMPLATE_FOLDER_ID"
  ].filter((name) => !process.env[name]);
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

  if (!response.ok) {
    throw new Error(`Microsoft token ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Microsoft no devolvio access_token.");
  return payload.access_token;
}

async function graphFetch<T>(pathOrUrl: string, init?: RequestInit): Promise<T> {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${await getGraphAccessToken()}`,
      accept: "application/json",
      "content-type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    throw new Error(`Microsoft Graph ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  return response.json() as Promise<T>;
}

async function getChildren(parentId: string) {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const children: GraphDriveItem[] = [];
  let nextUrl: string | undefined = `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder&$top=200`;

  while (nextUrl) {
    const page: GraphChildrenResponse = await graphFetch<GraphChildrenResponse>(nextUrl);
    children.push(...page.value);
    nextUrl = page["@odata.nextLink"];
  }

  return children;
}

async function findChildFolder(parentId: string, folderName: string) {
  const children = await getChildren(parentId);
  return children.find((item) => item.name.toLowerCase() === folderName.toLowerCase() && item.folder);
}

async function getGraphStatusParent(status: ProjectFolderStatus) {
  const studiesFolderId = requiredEnv("MS_GRAPH_STUDIES_FOLDER_ID");
  const statusFolderName = STATUS_FOLDER_NAMES[status];
  if (!statusFolderName) return { id: studiesFolderId, name: "ESTUDIOS" };

  const folder = await findChildFolder(studiesFolderId, statusFolderName);
  if (!folder) throw new Error(`No se encuentra la carpeta de destino en ESTUDIOS: ${statusFolderName}`);
  return { id: folder.id, name: statusFolderName, webUrl: folder.webUrl };
}

async function findGraphProjectFolderEverywhere(folderName: string) {
  const studiesFolderId = requiredEnv("MS_GRAPH_STUDIES_FOLDER_ID");
  const candidates: Array<{ status: ProjectFolderStatus; parentId: string; parentName: string }> = [
    { status: "fase_estudio", parentId: studiesFolderId, parentName: "ESTUDIOS" }
  ];

  for (const status of ["pendiente_adjudicar", "desestimado"] as const) {
    const statusFolderName = STATUS_FOLDER_NAMES[status];
    if (!statusFolderName) continue;
    const folder = await findChildFolder(studiesFolderId, statusFolderName);
    if (folder) candidates.push({ status, parentId: folder.id, parentName: statusFolderName });
  }

  for (const candidate of candidates) {
    const folder = await findChildFolder(candidate.parentId, folderName);
    if (folder) return { ...candidate, folder };
  }

  return null;
}

export async function assertGraphProjectFolderCanBeCreated(projectName: string) {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const studiesFolderId = requiredEnv("MS_GRAPH_STUDIES_FOLDER_ID");
  const templateFolderId = requiredEnv("MS_GRAPH_TEMPLATE_FOLDER_ID");
  const folderName = sanitizeGraphFolderName(projectName);

  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");

  await graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${studiesFolderId}`);
  const template = await graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${templateFolderId}`);
  if (!template.folder) throw new Error("MS_GRAPH_TEMPLATE_FOLDER_ID no apunta a una carpeta.");

  const existing = await findChildFolder(studiesFolderId, folderName);
  if (existing) throw new Error(`La carpeta ya existe en ESTUDIOS: ${folderName}`);

  return { provider: "microsoft-graph", folderName, parentId: studiesFolderId, templateId: templateFolderId };
}

export async function copyGraphProjectTemplate(projectName: string) {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const { folderName, parentId, templateId } = await assertGraphProjectFolderCanBeCreated(projectName);

  const response = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${templateId}/copy`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await getGraphAccessToken()}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      parentReference: { id: parentId },
      name: folderName
    })
  });

  if (response.status !== 202) {
    throw new Error(`Microsoft Graph copy ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  return {
    provider: "microsoft-graph",
    path: folderName,
    status: "copy-started",
    monitorUrl: response.headers.get("location")
  };
}

export async function deleteGraphProjectFolder(projectName: string) {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const folderName = sanitizeGraphFolderName(projectName);

  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");
  if (folderName === "PlantillaProyectos") throw new Error("No se puede eliminar la carpeta de plantilla.");

  const existing = await findGraphProjectFolderEverywhere(folderName);
  if (!existing) {
    return { provider: "microsoft-graph", deleted: false, path: folderName, reason: "La carpeta no existia." };
  }

  await graphFetch<void>(`/drives/${driveId}/items/${existing.folder.id}`, { method: "DELETE" });
  return { provider: "microsoft-graph", deleted: true, path: folderName, webUrl: existing.folder.webUrl };
}

export async function moveGraphProjectFolder(projectName: string, status: ProjectFolderStatus) {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const folderName = sanitizeGraphFolderName(projectName);

  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");
  if (folderName === "PlantillaProyectos") throw new Error("No se puede mover la carpeta de plantilla.");

  const destination = await getGraphStatusParent(status);
  const existing = await findGraphProjectFolderEverywhere(folderName);
  if (!existing) {
    return { provider: "microsoft-graph", moved: false, path: folderName, reason: "La carpeta no existia." };
  }

  if (existing.parentId === destination.id) {
    return { provider: "microsoft-graph", moved: false, path: folderName, reason: "La carpeta ya estaba en el estado indicado." };
  }

  const conflict = await findChildFolder(destination.id, folderName);
  if (conflict) throw new Error(`Ya existe una carpeta con este nombre en ${destination.name}: ${folderName}`);

  const moved = await graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${existing.folder.id}`, {
    method: "PATCH",
    body: JSON.stringify({ parentReference: { id: destination.id } })
  });

  return {
    provider: "microsoft-graph",
    moved: true,
    path: folderName,
    from: existing.parentName,
    to: destination.name,
    webUrl: moved.webUrl
  };
}

export async function graphDiagnostics() {
  const configured = isMicrosoftGraphConfigured();
  if (!configured) return { configured, missing: graphMissingEnv() };

  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const studiesFolderId = requiredEnv("MS_GRAPH_STUDIES_FOLDER_ID");
  const templateFolderId = requiredEnv("MS_GRAPH_TEMPLATE_FOLDER_ID");
  const [studies, template, children] = await Promise.all([
    graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${studiesFolderId}`),
    graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${templateFolderId}`),
    getChildren(studiesFolderId)
  ]);

  return {
    configured,
    driveId,
    studies: { id: studies.id, name: studies.name, webUrl: studies.webUrl },
    template: { id: template.id, name: template.name, webUrl: template.webUrl, isFolder: Boolean(template.folder) },
    sampleChildren: children.slice(0, 20).map((item) => ({ id: item.id, name: item.name, isFolder: Boolean(item.folder) }))
  };
}
