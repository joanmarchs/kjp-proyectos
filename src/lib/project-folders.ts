import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertGraphProjectFolderCanBeCreated,
  copyGraphProjectTemplate,
  deleteGraphProjectFolder,
  isMicrosoftGraphConfigured,
  moveGraphProjectFolder,
  type ProjectFolderStatus
} from "./microsoft-graph";

const STUDIES_ROOT = "D:\\OneDrive - KJP\\ESTUDIOS";
const TEMPLATE_NAME = "PlantillaProyectos";
const STATUS_FOLDER_NAMES: Record<ProjectFolderStatus, string | null> = {
  fase_estudio: null,
  pendiente_adjudicar: "Z_PENDIENTE DE ADJUDICAR",
  desestimado: "X_DESESTIMADOS"
};

function sanitizeWindowsFolderName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export async function copyProjectTemplate(projectName: string) {
  if (isMicrosoftGraphConfigured()) {
    return copyGraphProjectTemplate(projectName);
  }

  const { source, destination } = await assertLocalProjectFolderCanBeCreated(projectName);
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  return { provider: "local", path: destination };
}

export async function assertProjectFolderCanBeCreated(projectName: string) {
  if (isMicrosoftGraphConfigured()) {
    return assertGraphProjectFolderCanBeCreated(projectName);
  }

  return assertLocalProjectFolderCanBeCreated(projectName);
}

async function assertLocalProjectFolderCanBeCreated(projectName: string) {
  const folderName = sanitizeWindowsFolderName(projectName);
  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");

  const source = path.join(STUDIES_ROOT, TEMPLATE_NAME);
  const destination = path.join(STUDIES_ROOT, folderName);

  try {
    await stat(source);
  } catch {
    throw new Error(`No se encuentra la plantilla: ${source}`);
  }

  try {
    await stat(destination);
    throw new Error(`La carpeta ya existe: ${destination}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("La carpeta ya existe")) throw error;
  }

  return { provider: "local", source, destination };
}

export async function deleteProjectFolder(projectName: string) {
  if (isMicrosoftGraphConfigured()) {
    return deleteGraphProjectFolder(projectName);
  }

  const folderName = sanitizeWindowsFolderName(projectName);
  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");
  if (folderName === TEMPLATE_NAME) throw new Error("No se puede eliminar la carpeta de plantilla.");

  const root = path.resolve(STUDIES_ROOT);
  const found = await findLocalProjectFolder(folderName);
  const target = found?.path ?? path.resolve(STUDIES_ROOT, folderName);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("La carpeta destino esta fuera de ESTUDIOS.");

  if (!found) {
    return { provider: "local", deleted: false, path: target, reason: "La carpeta no existia." };
  }

  await rm(target, { recursive: true, force: false });
  return { provider: "local", deleted: true, path: target };
}

export async function moveProjectFolder(projectName: string, status: ProjectFolderStatus) {
  if (isMicrosoftGraphConfigured()) {
    return moveGraphProjectFolder(projectName, status);
  }

  const folderName = sanitizeWindowsFolderName(projectName);
  if (!folderName) throw new Error("El nombre de carpeta del proyecto no es valido.");
  if (folderName === TEMPLATE_NAME) throw new Error("No se puede mover la carpeta de plantilla.");

  const found = await findLocalProjectFolder(folderName);
  if (!found) {
    return { provider: "local", moved: false, path: folderName, reason: "La carpeta no existia." };
  }

  const destinationParent = localStatusParent(status);
  const destination = path.resolve(destinationParent, folderName);
  assertInsideStudies(destination);

  if (path.resolve(found.path) === destination) {
    return { provider: "local", moved: false, path: destination, reason: "La carpeta ya estaba en el estado indicado." };
  }

  await mkdir(destinationParent, { recursive: true });
  try {
    await stat(destination);
    throw new Error(`Ya existe una carpeta con este nombre en destino: ${destination}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Ya existe una carpeta")) throw error;
  }

  await rename(found.path, destination);
  return { provider: "local", moved: true, path: destination, from: found.parentName, to: STATUS_FOLDER_NAMES[status] ?? "ESTUDIOS" };
}

function localStatusParent(status: ProjectFolderStatus) {
  const folderName = STATUS_FOLDER_NAMES[status];
  return folderName ? path.join(STUDIES_ROOT, folderName) : STUDIES_ROOT;
}

async function findLocalProjectFolder(folderName: string) {
  const candidates: Array<{ parentName: string; path: string }> = [
    { parentName: "ESTUDIOS", path: path.join(STUDIES_ROOT, folderName) },
    { parentName: "Z_PENDIENTE DE ADJUDICAR", path: path.join(STUDIES_ROOT, "Z_PENDIENTE DE ADJUDICAR", folderName) },
    { parentName: "X_DESESTIMADOS", path: path.join(STUDIES_ROOT, "X_DESESTIMADOS", folderName) }
  ];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate.path);
      if (info.isDirectory()) return candidate;
    } catch {
      // Keep looking in the next status folder.
    }
  }

  return null;
}

function assertInsideStudies(targetPath: string) {
  const root = path.resolve(STUDIES_ROOT);
  const target = path.resolve(targetPath);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("La carpeta destino esta fuera de ESTUDIOS.");
}
