# Publicar online desde Windows con Cloudflare Tunnel

Esta opción mantiene funcionando la copia/borrado de carpetas en:

`D:\OneDrive - KJP\ESTUDIOS`

## 1. Arrancar la app en producción

Desde `C:\Users\joanm\Documents\kjp datos obras`:

```powershell
.\deploy\windows\start-production.ps1
```

La app quedará escuchando en:

`http://localhost:3026`

## 2. Crear el túnel de Cloudflare

Instala `cloudflared` en el Windows donde estará corriendo la app.

Después inicia sesión:

```powershell
cloudflared tunnel login
```

Crea un túnel:

```powershell
cloudflared tunnel create kjp-proyectos
```

Copia `deploy/windows/cloudflared-config.example.yml` a:

`C:\Users\<usuario>\.cloudflared\config.yml`

Edita:

- `YOUR_TUNNEL_ID`
- `credentials-file`
- `hostname`

## 3. Crear el DNS

Ejemplo:

```powershell
cloudflared tunnel route dns kjp-proyectos proyectos.tudominio.com
```

## 4. Ejecutar el túnel

```powershell
cloudflared tunnel run kjp-proyectos
```

## 5. Dejarlo como servicio de Windows

Cuando todo funcione:

```powershell
cloudflared service install
```

## Variables necesarias

El archivo `.env.local` debe existir en el proyecto con:

```env
HOLDED_API_KEY=...
HOLDED_API_BASE_URL=https://api.holded.com/api
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

No publiques este archivo.
