# Direct Dependencies Documentation

This document details all important direct production and development dependencies for the Personal Loan Collection Management application, including their purpose, justification, and migration/compatibility notes.

---

## Production Dependencies

### 1. `next`
- **Version**: `15.5.27`
- **Purpose**: Core application framework providing React Server Components, App Router, server-side data fetching, Server Actions, API routes, and optimized production bundling.
- **Why it is used**: Stable, maintained production framework with native Vercel deployment support and zero-config asset optimization.
- **Compatibility Notes**: Uses React 19. All server actions and App Router conventions follow standard Next.js 15+ patterns.

### 2. `react` & `react-dom`
- **Version**: `^19.0.0`
- **Purpose**: Core UI rendering and DOM reconciliation.
- **Why it is used**: Modern React standard with support for Server Components, `useActionState`, and optimistic UI updates.
- **Compatibility Notes**: Fully compatible with Next.js 15.5+ and all included utility libraries.

### 3. `drizzle-orm`
- **Version**: `^0.45.3`
- **Purpose**: TypeScript Object-Relational Mapping (ORM) and query builder for PostgreSQL.
- **Why it is used**: Lightweight, zero-overhead, type-safe SQL builder with explicit schema definitions. Unlike heavy ORMs (such as Prisma), Drizzle compiles to direct SQL queries, produces tiny serverless bundles, and has native transaction and pooling support for Supabase.
- **Compatibility Notes**: Works with `postgres` (postgres.js). Security-patched version 0.45.3 eliminates past advisory risks.

### 4. `postgres`
- **Version**: `^3.4.5`
- **Purpose**: Native PostgreSQL client driver for Node.js / Serverless runtimes.
- **Why it is used**: Fast, pure-JavaScript Postgres driver with zero binary dependencies (no C/C++ build tools required), native SSL support, and full connection pool management suitable for Supabase Transaction Pooler and Direct connections.
- **Compatibility Notes**: Pass `prepare: false` when connecting through Supabase's transaction pooler (PgBouncer).

### 5. `zod`
- **Version**: `^3.24.2`
- **Purpose**: Schema declaration and runtime validation for forms, API endpoints, and financial inputs.
- **Why it is used**: Type inference ensures compile-time and runtime validation align perfectly. Used to validate borrower names, phone numbers, loan amounts, and collection payments before hitting the database.
- **Compatibility Notes**: Integrated seamlessly with `@hookform/resolvers/zod`.

### 6. `react-hook-form` & `@hookform/resolvers`
- **Version**: `^7.54.2` / `^3.10.0`
- **Purpose**: Uncontrolled form management with instant validation feedback.
- **Why it is used**: Minimizes unnecessary re-renders on mobile devices, ensuring snappy keyboard response when entering numbers or borrower details.
- **Compatibility Notes**: Standard resolver integration with Zod schemas.

### 7. `date-fns`
- **Version**: `^4.1.0`
- **Purpose**: Modern, modular date manipulation and formatting.
- **Why it is used**: Tree-shakeable, immutable date calculations for daily collections, relative dates (today, yesterday, this week, this month), and timestamp displays.
- **Compatibility Notes**: Native ES modules, lightweight footprint.

### 8. `lucide-react`
- **Version**: `^0.475.0`
- **Purpose**: Crisp, accessible SVG icons designed for mobile UI.
- **Why it is used**: Complete tree-shakeable icon set matching modern design systems (dashboard, users, wallet, calendar, search, check, arrow-left, etc.).
- **Compatibility Notes**: Only imported icons are included in the production bundle.

### 9. `clsx` & `tailwind-merge`
- **Version**: `^2.1.1` / `^3.0.2`
- **Purpose**: Conditional CSS class name concatenation and conflict resolution (`cn` utility).
- **Why it is used**: Standard utility for flexible Tailwind CSS component composition without specificity conflicts.
- **Compatibility Notes**: Minimal size (<2KB combined).

### 10. `dotenv`
- **Version**: `^16.4.7`
- **Purpose**: Environment variable loading for CLI tools (seeds and migrations).
- **Why it is used**: Loads `.env.local` and `.env` when executing standalone scripts (`npm run db:seed`, `npm run db:migrate`).
- **Compatibility Notes**: Development/scripting utility; Next.js handles `.env` automatically during web execution.

---

## Development Dependencies

### 1. `drizzle-kit`
- **Version**: `^0.31.11`
- **Purpose**: Schema migration generator and database introspection CLI.
- **Why it is used**: Generates standard SQL migrations in `lib/db/migrations` and synchronizes schema definitions with PostgreSQL databases.

### 2. `tsx`
- **Version**: `^4.19.3`
- **Purpose**: Fast TypeScript script execution engine powered by esbuild.
- **Why it is used**: Used to run `lib/db/seed.ts` and `lib/db/migrate.ts` directly without manual pre-compilation.

### 3. `tailwindcss`, `postcss`, `autoprefixer`
- **Version**: `^3.4.17` / `^8.5.3` / `^10.4.20`
- **Purpose**: Utility-first CSS styling and vendor prefixing.
- **Why it is used**: Generates a lean, mobile-optimized stylesheet purged of unused classes.

### 4. `typescript` & `@types/*`
- **Version**: `^5.7.3`
- **Purpose**: Static type checking and IntelliSense.
- **Why it is used**: Strict type safety ensures financial calculations and database schemas cannot introduce silent type errors.
