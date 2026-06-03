# KJP Costes por Proyecto 2026

Dashboard Next.js para leer datos reales de Holded, agregarlos por proyecto y persistirlos en Supabase.

## Configuración

1. Ejecuta el SQL de `supabase/schema.sql` en el SQL editor del proyecto:
   `https://asfdtvdvgbstiulvxabb.supabase.co`
2. Completa `.env.local` con:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` si quieres usarla en futuras funciones de cliente
3. Arranca la app:

```bash
npm.cmd run dev -- -p 3005
```

## Uso

- `GET /api/projects`: lee Supabase; si no hay configuración o filas, usa Holded como fallback.
- `POST /api/sync`: lee Holded y guarda los agregados en `project_costs_2026` cuando existe `SUPABASE_SERVICE_ROLE_KEY`.

La clave de Holded queda en `.env.local` y no se envía al navegador.

## Publicación online recomendada

Para publicar manteniendo la creación/borrado de carpetas en OneDrive local, usa un Windows fijo con Cloudflare Tunnel.

Guía: `deploy/windows/README.md`

Para publicar en Vercel y gestionar carpetas de OneDrive/SharePoint online, usa Microsoft Graph.

Guía: `deploy/vercel/README.md`
