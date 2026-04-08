# Backend (Express + Prisma + Better Auth)

## Purpose

API multiempresa para administración y autenticación por invitación.
Roles soportados:
- `ADMIN` (global)
- `CLIENT_ADMIN` (acotado a una sola empresa)

## Stack

- Node.js + Express + TypeScript
- Prisma ORM + MySQL
- Better Auth (sesiones por cookie)
- Zod (DTO/validación)
- Nodemailer (emails de invitación)
- Storage local para logos (`storage/uploads`)

## Folder structure

```text
src/
  app.ts
  server.ts
  config/
  controllers/
  services/
  repositories/
  routes/
  middlewares/
  dto/
  validators/
  lib/
  utils/
  types/
  templates/
prisma/
  schema.prisma
  seed.ts
storage/uploads/
```

## API response format

Todas las rutas públicas responden con:

```json
{
  "error": false,
  "mensaje": "string",
  "data": {},
  "mensajeTecnico": null
}
```

En error:

```json
{
  "error": true,
  "mensaje": "string",
  "data": null,
  "mensajeTecnico": "detalle técnico"
}
```

## Audit logging behavior

- El registro de auditoría es `best-effort` (no bloqueante).
- Si falla la persistencia de auditoría, la operación principal de negocio no se revierte por ese motivo.
- El backend registra el fallo de auditoría con contexto (`actor`, `action`, `requestId`) para investigación posterior.

## Better Auth configuration

- `emailAndPassword.enabled = true`
- `emailAndPassword.disableSignUp = true` (no signup público)
- base interna: `/api/auth/internal`
- sesiones `httpOnly`, `sameSite=lax`, `secure` en producción
- campos de dominio en usuario Better Auth:
  - `role`
  - `companyId`
  - `isActive`

### Why cookies over JWT localStorage

Se usan cookies `httpOnly` para reducir riesgo de robo de token por XSS.
El frontend no manipula el token de sesión directamente.

## Company slug login restriction

- `/login` (global): permite `ADMIN` y `CLIENT_ADMIN`.
- `/:companySlug/login`: requiere `companySlug` válido y existente.
- `CLIENT_ADMIN` solo puede autenticarse si pertenece a ese slug.
- intento cross-company => `INVALID_COMPANY_CONTEXT`.
- `ADMIN` no puede autenticarse por ruta de empresa => `ADMIN_GLOBAL_LOGIN_ONLY`.

## Invitation flow

1. `ADMIN` crea empresa (`POST /api/companies`).
2. Se genera token seguro, se guarda hash (`sha256`) y se envía email.
3. Email apunta a `/invite/accept?token=<rawToken>`.
4. Frontend valida token (`GET /api/invitations/validate`).
5. Usuario define contraseña (`POST /api/invitations/accept`).
6. Backend crea `CLIENT_ADMIN`, marca invitación `acceptedAt`, activa empresa y crea sesión.

### Token safety

- Single-use (`acceptedAt` bloquea reuso)
- Expiración (`expiresAt`)
- Revocación (`revokedAt`)
- No se almacena token raw en DB (solo hash)

## Core routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/company-context/:slug`
- `GET /api/invitations/validate?token=...`
- `POST /api/invitations/accept`
- `POST /api/uploads/company-logo`
- `POST /api/companies`
- `GET /api/companies`
- `GET /api/companies/:id`
- `PUT /api/companies/:id`
- `POST /api/companies/:id/resend-invite`

## Environment variables

Archivo: `.env.example`

- `DATABASE_URL="mysql://root:password@localhost:3306/talentum"`
- `PORT=4000`
- `FRONTEND_URL="http://localhost:3000"`
- `AUTH_SECRET="replace_with_a_long_secret"`
- `AUTH_BASE_URL="http://localhost:4000"`
- `SMTP_HOST="smtp.example.com"`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER="user@example.com"`
- `SMTP_PASS="password"`
- `SMTP_FROM="Talentum <no-reply@example.com>"`
- `UPLOAD_DIR="storage/uploads"`
- `INVITATION_TOKEN_EXPIRES_HOURS=72`
- `MAX_UPLOAD_SIZE_MB=5`
- `DATABASE_CONTRACT_CHECK_ENABLED=true`

## First run (local)

1. `cp .env.example .env`
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:migrate:dev -- --name init`
5. `npm run prisma:seed`
6. `npm run dev`

## Prisma migration workflow (safe)

### Development

1. Modificar `prisma/schema.prisma`.
2. Crear migración con `npm run prisma:migrate:dev -- --name <descripcion>`.
3. Validar estado con `npm run prisma:check`.

### Production

1. Desplegar código y carpeta `prisma/migrations`.
2. Aplicar migraciones con `npm run prisma:deploy`.
3. Confirmar estado con `npm run prisma:migrate:status`.

Notas:
- No usar `prisma db push` en producción.
- El backend valida artefactos críticos de schema al arrancar (`DATABASE_CONTRACT_CHECK_ENABLED`).

## Seed data

El seed crea:
- 1 `ADMIN` inicial
- 1 empresa ejemplo (`acme`)
- 1 invitación pendiente para manager

Credenciales de seed (solo desarrollo):
- admin email: `admin@talentum.local`
- admin password: `Admin12345!`
- invitation token raw: `seed-invite-token-acme-manager`

## Manual QA checklist

- [ ] Login global con `ADMIN` funciona.
- [ ] `ADMIN` no entra por `/:companySlug/login`.
- [ ] Crear empresa genera invitación y estado inicial `PENDING_SETUP`.
- [ ] Validación de invitación con token válido responde OK.
- [ ] Token expirado/revocado/usado retorna error correcto.
- [ ] Aceptar invitación crea `CLIENT_ADMIN` y sesión.
- [ ] `CLIENT_ADMIN` solo accede a su empresa (`GET/PUT /companies/:id`).
- [ ] Listado de empresas para `CLIENT_ADMIN` devuelve solo su empresa.
- [ ] Upload de logo acepta solo imágenes válidas y respeta tamaño máximo.

## Known limitations / next improvements

- Falta suite automática de tests (unit/integration/e2e).
- Falta rate limiting para endpoints sensibles (`/auth/login`, invitaciones).
- Storage de archivos está en disco local (migrable a S3/GCS).
- Falta módulo real de encuestas (actualmente placeholder en frontend).
