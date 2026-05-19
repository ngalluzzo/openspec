---
outline: [2, 3]
---

# Installation

## Prerequisites

- Node.js 18+ (Node 22+ recommended for built-in glob support)
- TypeScript 5.0+

## Install Packages

Install the packages you need. You don't need all of them — pick based on your use case.

### For CLI usage (simplest path)

```bash
npm install @reforge/core @reforge/transform @reforge/adapters @reforge/cli
```

### For programmatic usage

```bash
npm install @reforge/core @reforge/transform @reforge/adapters
```

### For recipe-based workflows

```bash
npm install @reforge/core @reforge/transform @reforge/adapters @reforge/recipes
```

### Peer dependencies

Some packages have peer dependencies you'll need to install separately:

```bash
# For TypeScript support (required by @reforge/adapters)
npm install typescript

# For CSS/SCSS support (optional, required by @reforge/adapters/css)
npm install postcss
```

## Monorepo Setup

Reforge is designed to work in monorepos. Add it to your workspace:

```json
{
  "workspaces": ["packages/*", "docs"]
}
```

Then install in the workspace root. Each package resolves its dependencies through the workspace.

## TypeScript Configuration

Reforge uses ESM modules. Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Next Steps

- [Quick Start](/getting-started/quick-start) — Write your first codemod in 5 minutes
- [Core Overview](/core/overview) — Understand the parsing and printing engine
