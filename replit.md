# TJPE Archive Management System

## Overview
Web-based Archive Management System for TJPE (Tribunal de Justiça de Pernambuco). Citizens and lawyers submit document retrieval requests through a public form; administrators and attendants manage these requests through an admin panel.

## Current State
Full-stack application with Express backend, PostgreSQL database, and React frontend. All features fully functional with real data persistence.

## User Preferences
- All UI text in Brazilian Portuguese (pt-BR)
- Default admin: edilson.ferreira@tjpe.jus.br / MinhaSenha!@#
- TJPE branding with custom logo and favicon
- Input masks: CPF (000.000.000-00), Phone ((00) 00000-0000), Process (0000000-00.0000.0.00.0000)

## Project Architecture
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui + wouter routing
- **Backend**: Express.js with session-based auth (connect-pg-simple)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: bcrypt password hashing, express-session

### Key Files
- `shared/schema.ts` - Data models (users, requests, observations)
- `server/routes.ts` - API routes with auth middleware
- `server/storage.ts` - Database CRUD operations via Drizzle
- `server/db.ts` - Database connection
- `client/src/pages/Home.tsx` - Public request form
- `client/src/pages/Login.tsx` - Admin login page
- `client/src/pages/Admin.tsx` - Admin panel (requests, dashboard, users)
- `client/src/lib/api.ts` - API client functions

### API Routes
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- GET/POST /api/requests, GET/PATCH/DELETE /api/requests/:id
- GET/POST /api/requests/:id/observations
- GET/POST/PATCH/DELETE /api/users (admin only)
- GET /api/dashboard (admin only)

### Roles
- `admin` - Full access including dashboard and user management
- `atendente` - Request management only

### Request Statuses
- novo, em_analise, aprovado, indeferido

## Recent Changes
- 2026-02-22: Converted from localStorage mockup to full-stack with PostgreSQL
- Added session-based authentication with bcrypt
- Implemented all CRUD API endpoints
- Dashboard stats computed from real database data
