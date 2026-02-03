# Open Agent Codebase Guide

## Commands
- **Dev Server**: `deno task dev`
- **Build**: `deno task build`
- **Lint/Format**: `deno task check` (uses Biome to lint, format, and organize imports)
- **Test**: No test script currently defined in package.json.

## Architecture
- **Framework**: Next.js 16 (App Router), React 19.
- **Styling**: Tailwind CSS v4, shadcn/ui components (using `@base-ui/react`), Lucide icons.
- **Tooling**: Biome for fast linting/formatting.
- **Structure**: `app/` (routes), `components/` (UI), `lib/` (utils).

## Code Style & Conventions
- **Formatting**: Rely on Biome (`deno task check`). Double quotes, 2-space indent.
- **Components**: Functional components with strict TypeScript types.
- **Styling**: Use utility classes (Tailwind) and `clsx`/`tailwind-merge` for conditional styles.
- **Imports**: Organized automatically by Biome. Prefer absolute imports if configured.
- **State**: Use React 19 hooks and features.

## Strict Type Safety
- **Forbidden**:
  - `any`, `unknown`, `z.any()`, `z.unknown()`, `z.record()`.
  - `[key: string]: unknown`, `JsonObject`, `JsonValue`, `Record<string, unknown>` (unless strictly necessary and validated).
  - Type assertions (`as Type`, `as unknown`, `as any`).
  - Suppression comments (`@ts-expect-error`, `biome-ignore`, `eslint-disable`).
- **Required**:
  - **Strict Typing**: Use specific, structural types. Define types for all props and state.
  - **Validation**: Use Zod schemas for external data or loose types.
  - **Utilities**: Leverage `type-fest` and built-in TypeScript utilities (Pick, Omit, Partial, etc.).
  - **Inference**: Rely on type inference by typing variables at definition/declaration rather than casting at usage.
  - **Type Guards**: Use custom type guards or Zod parsing to narrow types safely.
  - **Generics**: Use generics to maintain type safety across reusable functions.
