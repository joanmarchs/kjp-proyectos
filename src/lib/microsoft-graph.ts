type GraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  folder?: unknown;
  parentReference?: {
    id?: string;
    driveId?: string;
  };
};

type GraphChildrenResponse = {
  value: GraphDriveItem[];
  "@odata.nextLink"?: string;
};

export type ProjectFolderStatus =
  | "fase_estudio"
  | "pendiente_adjudicar"
  | "desestimado"
  | "fase_obra"
  | "pendiente_facturar"
  | "facturado";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const STATUS_DESTINATIONS: Record<ProjectFolderStatus, { rootName: "ESTUDIOS" | "OBRAS"; childName: string | null }> = {
  fase_estudio: { rootName: "ESTUDIOS", childName: null },
  pendiente_adjudicar: { rootName: "ESTUDIOS", childName: "Z_PENDIENTE DE ADJUDICAR" },
  desestimado: { rootName: "ESTUDIOS", childName: "X_DESESTIMADOS" },
  fase_obra: { rootName: "OBRAS", childName: null },
  pendiente_facturar: { rootName: "OBRAS", childName: "Z_PENDIENTE DE FACTURAR" },
  facturado: { rootName: "OBRAS", childName: "X_FACTURADO" }
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

async function getChildren(driveId: string, parentId: string) {
  const children: GraphDriveItem[] = [];
  let nextUrl: string | undefined = `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder&$top=200`;

  while (nextUrl) {
    const page: GraphChildrenResponse = await graphFetch<GraphChildrenResponse>(nextUrl);
    children.push(...page.value);
    nextUrl = page["@odata.nextLink"];
  }

  return children;
}

async function findChildFolder(driveId: string, parentId: string, folderName: string) {
  const children = await getChildren(driveId, parentId);
  return children.find((item) => item.name.toLowerCase() === folderName.toLowerCase() && item.folder);
}

async function getGraphStatusParent(status: ProjectFolderStatus) {
  const destination = STATUS_DESTINATIONS[status];
  const root = await getGraphRootFolder(destination.rootName);
  if (!destination.childName) return { driveId: root.driveId, id: root.id, name: destination.rootName, webUrl: root.webUrl };

  const folder = await findChildFolder(root.driveId, root.id, destination.childName);
  if (!folder) throw new Error(`No se encuentra la carpeta de destino en ${destination.rootName}: ${destination.childName}`);
  return { driveId: root.driveId, id: folder.id, name: destination.childName, webUrl: folder.webUrl };
}

async function findGraphProjectFolderEverywhere(folderName: string) {
  const candidates: Array<{ status: ProjectFolderStatus; driveId: string; parentId: string; parentName: string }> = [];

  for (const status of Object.keys(STATUS_DESTINATIONS) as ProjectFolderStatus[]) {
    try {
      const parent = await getGraphStatusParent(status);
      candidates.push({ status, parentId: parent.id, parentName: parent.name, driveId: parent.driveId });
    } catch {
      // Missing optional status folders should not stop searching other locations.
    }
  }

  for (const candidate of candidates) {
    const folder = await findChildFolder(candidate.driveId, candidate.parentId, folderName);
    if (folder) return { ...candidate, folder };
  }

  return null;
}

async function getGraphRootFolder(rootName: "ESTUDIOS" | "OBRAS") {
  const driveId = requiredEnv("MS_GRAPH_DRIVE_ID");
  const studiesFolderId = requiredEnv("MS_GRAPH_STUDIES_FOLDER_ID");
  if (rootName === "ESTUDIOS") {
    const studies = await graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${studiesFolderId}`);
    return { ...studies, driveId };
  }

  const worksFolderId = process.env.MS_GRAPH_WORKS_FOLDER_ID?.trim();
  const worksDriveId = process.env.MS_GRAPH_WORKS_DRIVE_ID?.trim() || driveId;
  if (worksFolderId) {
    const works = await graphFetch<GraphDriveItem>(`/drives/${worksDriveId}/items/${worksFolderId}`);
    if (!works.folder) throw new Error("MS_GRAPH_WORKS_FOLDER_ID no apunta a una carpeta.");
    return { ...works, driveId: worksDriveId };
  }

  const studies = await graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${studiesFolderId}?$select=id,name,webUrl,folder,parentReference`);
  const parentId = studies.parentReference?.id;
  if (!parentId) throw new Error("No se pudo localizar la carpeta padre de ESTUDIOS para encontrar OBRAS.");

  const works = await findChildFolder(driveId, parentId, "OBRAS");
  if (!works) throw new Error("No se encuentra la carpeta OBRAS junto a ESTUDIOS. Configura MS_GRAPH_WORKS_FOLDER_ID en Vercel.");
  return { ...works, driveId };
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

  const existing = await findChildFolder(driveId, studiesFolderId, folderName);
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
  const folderName = sanitizeGraphFolderName(projectName);

  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");
  if (folderName === "PlantillaProyectos") throw new Error("No se puede eliminar la carpeta de plantilla.");

  const existing = await findGraphProjectFolderEverywhere(folderName);
  if (!existing) {
    return { provider: "microsoft-graph", deleted: false, path: folderName, reason: "La carpeta no existia." };
  }

  await graphFetch<void>(`/drives/${existing.driveId}/items/${existing.folder.id}`, { method: "DELETE" });
  return { provider: "microsoft-graph", deleted: true, path: folderName, webUrl: existing.folder.webUrl };
}

export async function moveGraphProjectFolder(projectName: string, status: ProjectFolderStatus) {
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

  const conflict = await findChildFolder(destination.driveId, destination.id, folderName);
  if (conflict) throw new Error(`Ya existe una carpeta con este nombre en ${destination.name}: ${folderName}`);

  const moved = await graphFetch<GraphDriveItem>(`/drives/${existing.driveId}/items/${existing.folder.id}`, {
    method: "PATCH",
    body: JSON.stringify({ parentReference: { driveId: destination.driveId, id: destination.id } })
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
  const [studies, template, children, works] = await Promise.all([
    graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${studiesFolderId}`),
    graphFetch<GraphDriveItem>(`/drives/${driveId}/items/${templateFolderId}`),
    getChildren(driveId, studiesFolderId),
    getGraphRootFolder("OBRAS").catch((error) => ({ error: error instanceof Error ? error.message : "No se pudo localizar OBRAS." }))
  ]);

  return {
    configured,
    driveId,
    studies: { id: studies.id, name: studies.name, webUrl: studies.webUrl },
    works:
      "error" in works
        ? works
        : { driveId: works.driveId, id: works.id, name: works.name, webUrl: works.webUrl, isFolder: Boolean(works.folder) },
    template: { id: template.id, name: template.name, webUrl: template.webUrl, isFolder: Boolean(template.folder) },
    sampleChildren: children.slice(0, 20).map((item) => ({ id: item.id, name: item.name, isFolder: Boolean(item.folder) }))
  };
}
