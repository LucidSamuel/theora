# Theora — Replit Project

## Overview
A Vite + React + TypeScript single-page application featuring interactive cryptographic and mathematical demos (Merkle trees, accumulators, polynomials, recursive proofs). Originally hosted on Vercel; migrated to Replit.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **Styling**: Tailwind CSS v4, tw-animate-css
- **Routing**: React Router DOM v7
- **UI Components**: Radix UI, shadcn/ui patterns, Lucide React icons
- **Testing**: Vitest

## Architecture
- `src/pages/` — top-level pages (Landing)
- `src/demos/` — individual interactive demos (accumulator, merkle, polynomial, recursive)
- `src/components/` — shared layout and UI components
- `src/hooks/` — custom React hooks (canvas, theme, URL state, etc.)
- `src/lib/` — utility functions (animation, canvas, math, hash, URL state)
- `src/types/` — TypeScript type definitions

## Running the App
The dev server runs via the "Start application" workflow:
```
npm run dev
```
Configured to listen on `0.0.0.0:5000` for Replit compatibility.

## Key Configuration
- `vite.config.ts` — sets `server.host: '0.0.0.0'`, `server.port: 5000`, `allowedHosts: true` for Replit preview
- `vercel.json` — SPA rewrite rule (kept for reference; not used on Replit)
- No environment variables required
