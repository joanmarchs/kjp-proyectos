import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertGraphProjectFolderCanBeCreated,
  copyGraphProjectTemplate,
  deleteGraphProjectFolder,
  isMicrosoftGraphConfigured
} from "./microsoft-graph";

const STUDIES_ROOT = "D:\\OneDrive - KJP\\ESTUDIOS";
const TEMPLATE_NAME = "PlantillaProyectos";

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
  const target = path.resolve(STUDIES_ROOT, folderName);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("La carpeta destino esta fuera de ESTUDIOS.");

  try {
    await stat(target);
  } catch {
    return { provider: "local", deleted: false, path: target, reason: "La carpeta no existia." };
  }

  await rm(target, { recursive: true, force: false });
  return { provider: "local", deleted: true, path: target };
}
