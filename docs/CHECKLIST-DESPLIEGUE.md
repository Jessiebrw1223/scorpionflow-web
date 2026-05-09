# Checklist de despliegue ScorpionFlow

## Supabase
- [ ] Rotar contraseña de base de datos si fue compartida.
- [ ] Confirmar URL del proyecto.
- [ ] Confirmar anon/publishable key.
- [ ] Confirmar JWT issuer: `https://<PROJECT_REF>.supabase.co/auth/v1`.
- [ ] Revisar RLS.

## Render
- [ ] Crear Web Service con root `backend/ScorpionFlow.Api`.
- [ ] Runtime Docker.
- [ ] Agregar `ConnectionStrings__DefaultConnection` como secret.
- [ ] Agregar variables Supabase.
- [ ] Probar `/api/health`.
- [ ] Probar `/api/health/db` con JWT válido.

## Vercel
- [ ] Agregar `VITE_API_URL`.
- [ ] Agregar variables públicas Supabase.
- [ ] Validar login.
- [ ] Validar API con JWT.
