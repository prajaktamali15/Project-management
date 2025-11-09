# Project Management System

A full-stack project management application built with Next.js, Prisma, and PostgreSQL.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **pnpm** (package manager)
- **PostgreSQL** (database)

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/prajaktamali15/Project-management.git
cd Project-management
```

### 2. Backend Setup

```bash
cd backend
```

**Install dependencies:**
```bash
pnpm install
```

**Configure environment variables:**
```bash
cp .env.example .env
```

Edit the `.env` file and configure:
- `DATABASE_URL`: Your PostgreSQL connection string
  - Format: `postgresql://username:password@localhost:5432/database_name?schema=public`
- `JWT_ACCESS_SECRET`: A strong random string for access tokens
- `JWT_REFRESH_SECRET`: A strong random string for refresh tokens
- `NODE_ENV`: Set to `development`

**Set up the database:**

For first-time setup (creates database tables):
```bash
pnpm prisma:migrate
```

Or if database already exists:
```bash
pnpm prisma:generate
```

**Start the backend server:**
```bash
pnpm dev
```
Backend will run on `http://localhost:4000`

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
```

**Install dependencies:**
```bash
pnpm install
```

**Configure environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` if your backend runs on a different URL (default is `http://localhost:4000`)

**Start the frontend server:**
```bash
pnpm dev
```
Frontend will run on `http://localhost:3000`

### 4. Access the Application

Open your browser and navigate to `http://localhost:3000`

## Project Structure

- **Backend** (`/backend`): Next.js API routes with Prisma ORM
- **Frontend** (`/frontend`): Next.js React application
- **Database**: PostgreSQL with Prisma migrations

## Features

- ✅ User authentication (JWT-based)
- ✅ Workspace management
- ✅ Project management with RBAC
- ✅ Task management with assignments
- ✅ Real-time updates via SSE
- ✅ Activity logging
- ✅ Unified search (workspaces & projects)
- ✅ Member management
- ✅ File attachments

## Available Scripts

### Backend
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations

### Frontend
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server

## Troubleshooting

**Database connection errors:**
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` in backend `.env` is correct
- Check database user has proper permissions

**Port already in use:**
- Backend: Change port in `backend/package.json` dev script
- Frontend: Change port in `frontend/package.json` dev script

**Prisma errors:**
- Run `pnpm prisma:generate` to regenerate the Prisma client
- Run `pnpm prisma:migrate` to apply pending migrations

## Notes

- Prisma client is pre-generated in `backend/src/generated/prisma`
- Real-time updates endpoint: `GET /api/realtime/stream`
- Default admin credentials will be created on first migration