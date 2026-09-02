# Merkeb Market

Merkeb Market is a mobile-first, bilingual marketplace for buying and
selling second-hand goods within Ethiopian communities.

The platform helps users publish listings, discover nearby products,
communicate securely, negotiate offers, arrange safe meetups, and build
trust through verified accounts and reviews.

## Initial technology stack

- Next.js and TypeScript
- NestJS
- PostgreSQL and Prisma
- Redis
- Docker Compose
- npm workspaces

## Repository structure

```text
apps/
  web/       Next.js frontend
  api/       NestJS backend
packages/
  shared/    Code intentionally shared between applications
```

This repository is managed with npm workspaces. Application code must be
created in the agreed paths so shared tooling can discover it consistently.

Install all workspace dependencies from the repository root with:

```bash
npm install
```

## Team workflow

Create a short-lived branch from the latest `main` for each task. Open a pull
request and have another team member review it before merging it into `main`.

Examples:

- `feat/web-foundation`
- `feat/api-foundation`
- `feat/dev-infrastructure`

## Project status

Early MVP development.
