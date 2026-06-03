# Publicar en Vercel con OneDrive/SharePoint mediante Microsoft Graph

Esta variante no usa `D:\OneDrive - KJP\ESTUDIOS`. En Vercel las carpetas se gestionan online con Microsoft Graph.

## 1. Variables de entorno en Vercel

Configura estas variables en Vercel:

```env
HOLDED_API_KEY=
HOLDED_API_BASE_URL=https://api.holded.com/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MS_GRAPH_DRIVE_ID=
MS_GRAPH_STUDIES_FOLDER_ID=
MS_GRAPH_TEMPLATE_FOLDER_ID=
```

## 2. Permisos Microsoft

En Microsoft Entra ID crea una App Registration con permisos de aplicación:

- `Sites.ReadWrite.All` si `ESTUDIOS` está en SharePoint.
- O `Files.ReadWrite.All` si se trabaja contra OneDrive.

Después concede admin consent.

## 3. Diagnóstico

Cuando despliegues, abre:

`/api/onedrive/diagnostics`

Debe devolver:

- `configured: true`
- datos de la carpeta `ESTUDIOS`
- datos de `PlantillaProyectos`
- una muestra de carpetas hijas

## 4. Comportamiento

Crear proyecto:

1. Crea el proyecto en Holded.
2. Copia online `PlantillaProyectos` dentro de `ESTUDIOS` con el nombre del proyecto.
3. Guarda el registro en Supabase.

Eliminar proyecto:

1. Elimina el proyecto en Holded.
2. Busca la carpeta con el mismo nombre dentro de `ESTUDIOS`.
3. La elimina con Microsoft Graph.
4. Elimina el registro en Supabase.

La copia de carpetas de Microsoft Graph es asíncrona: la API devuelve `copy-started` y Microsoft termina la copia en segundo plano.
