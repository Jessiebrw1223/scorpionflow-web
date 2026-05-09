# ScorpionFlow — Paquete parchado para staging

Cambios aplicados:

- `.gitignore` reforzado para excluir `.env*`, `node_modules`, `dist`, `.vercel`, `supabase/.temp` y `.zip`.
- `supabase/config.toml` actualizado al project ref actual: `hgjxmtpaatkvcvznpytm`.
- `.env.example` saneado como plantilla sin valores reales.
- `usePlan.ts` normalizado para `manual` / `mercadopago`, manteniendo compatibilidad temporal con campos legacy de Stripe.
- `PremiumRoute.tsx` agregado para bloquear rutas premium por URL directa.
- `App.tsx` protegido para `/finanzas`, `/costs`, `/resources`, `/reports`, `/riesgos`.
- `UpsellDialog.tsx` ajustado con `DialogTitle` y `DialogDescription` ocultos para evitar warnings de Radix.
- `Dashboard.tsx` limpio: sin tarjeta de desbloqueo en el header.
- Edge Functions de Mercado Pago reforzadas:
  - `create-mercadopago-checkout`
  - `mercadopago-webhook`
  - `cancel-mercadopago-subscription`
- Migración agregada: `20260508060000_normalize_payment_provider_manual.sql`.

Pendiente antes de producción:

1. Ejecutar la migración nueva en Supabase SQL Editor o vía Supabase CLI.
2. Configurar `FRONTEND_URL` en Supabase secrets con la URL pública de Vercel/dominio.
3. Redeploy de Edge Functions si cambias secrets o código.
4. Probar checkout completo y webhook real de Mercado Pago.
5. Rotar contraseña de Supabase Database si fue expuesta.
6. Probar RLS con dos usuarios y roles distintos.
7. Ejecutar `npm install` y `npm run build` en tu PC/Vercel.

Nota: En este entorno el build quedó en `transforming...` hasta timeout, así que valida el build en tu máquina o directamente en Vercel.
