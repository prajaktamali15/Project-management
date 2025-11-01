# Project-management

Quick start

Backend
- cd backend
- Copy .env.example to .env and fill values (DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ALLOWED_ORIGINS)
- pnpm install
- pnpm prisma:migrate (first run) or pnpm prisma:generate
- pnpm dev (starts on :4000)

Frontend
- cd frontend
- Optionally copy .env.example to .env and set NEXT_PUBLIC_API_BASE if backend is on a different origin
- pnpm install
- pnpm dev (starts on :3000)

Notes
- Large demo video file is ignored to keep the repo lightweight
- Prisma client is included under backend/src/generated/prisma for convenience; it can be regenerated via pnpm prisma:generate
- Real-time SSE endpoint: GET /api/realtime/stream