# ScorpionFlow — Arquitectura por fases

## Advertencia de seguridad
La cadena PostgreSQL/Supabase debe vivir solo en variables de entorno de Render. Nunca debe quedar en frontend, GitHub, ZIPs compartidos, logs ni archivos `.env` versionados. Después de compartirla, rota la contraseña en Supabase y actualiza Render.

## Arquitectura objetivo
```text
Usuario → Vercel: React/Vite/TS → HTTPS + JWT Supabase → Render: ASP.NET Core 8 API → Npgsql/Dapper → Supabase: PostgreSQL/Auth/RLS/Storage
```

Regla: **Vercel muestra. Render decide. Supabase guarda y protege.**

## Fase 0 — Seguridad
- `.env` eliminado del paquete.
- `.env.example` creado.
- `.gitignore` actualizado para bloquear secretos.
- La conexión PostgreSQL va en `ConnectionStrings__DefaultConnection` en Render.

## Fase 1 — Backend base
Creado `backend/ScorpionFlow.Api` con Minimal API, JWT Supabase, CORS, conexión PostgreSQL y manejo centralizado de errores.

Endpoints:
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/workspace/current`
- `GET /api/workspace/members`
- `GET /api/projects/summary`
- `GET /api/reports/executive`

## Fase 2 — Frontend consume API
Creado:
- `src/services/api/http-client.ts`
- `src/modules/workspace/api/workspace-api.ts`
- `src/modules/projects/api/projects-api.ts`
- `src/modules/reports/api/reports-api.ts`

El cliente toma el JWT de Supabase Auth y lo envía al backend.

## Fase 3 — Reglas de negocio al backend
Mover cálculos financieros, permisos, límites de plan, reportes, invitaciones, auditoría, Mercado Pago y generación de PDFs al backend.

## Fase 4 — Modularización enterprise
Backend recomendado: Auth, Workspace, Clients, Quotations, Projects, Tasks, Resources, Costs, Risks, Reports, Billing, Audit.
Frontend recomendado: `src/modules/*` por dominio.

## Fase 5 — Producción SaaS
Agregar audit logs, rate limiting, workers, cola de emails, webhooks robustos, cache de reportes, backups, monitoreo y pruebas e2e.

## Variables Render
```env
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:${PORT}
ConnectionStrings__DefaultConnection=postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
Supabase__Url=https://<PROJECT_REF>.supabase.co
Supabase__JwtIssuer=https://<PROJECT_REF>.supabase.co/auth/v1
Supabase__JwtAudience=authenticated
```

## Variables Vercel
```env
VITE_API_URL=https://scorpionflow-api.onrender.com
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<PROJECT_REF>
```
