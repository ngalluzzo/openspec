---
outline: [2, 3]
---

# Quick Start

Write your first format-preserving codemod in under 5 minutes.

## Step 1: Install

```bash
npm install @reforge/core @reforge/transform @reforge/adapters @reforge/cli
```

## Step 2: Create a Transform File

Create `migrate-imports.ts`:

```ts
import { tsAdapter } from "@reforge/adapters/typescript"

type TransformContext = {
  query: import("@reforge/transform").QueryBuilder<any>
  filePath: string
  snippet: (source: string) => any
}

export default function transform({ query }: TransformContext) {
  // Replace lodash imports with lodash-es
  query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
    ;(path.node).moduleSpecifier = "lodash-es"
  })

  // Rename a function call
  query.find("CallExpression[callee.name=forEach]").mutate((path) => {
    ;(path.node).callee.name = "each"
  })
}
```

## Step 3: Run It

```bash
# Preview changes without writing
reforge -t ./migrate-imports.ts "src/**/*.ts" --dry-run

# Apply changes
reforge -t ./migrate-imports.ts "src/**/*.ts"
```

## Step 4: See the Results

Reforge prints a summary showing which files changed:

```
✓ src/utils/helpers.ts (3 changes)
✓ src/services/api.ts (1 change)
✗ src/components/Button.tsx (unchanged)
```

## What Just Happened?

1. **Parse** — Each file was parsed into an AST with a shadow-copy of the original source
2. **Query** — The selector `"ImportDeclaration[moduleSpecifier=lodash]"` found all matching nodes
3. **Mutate** — Each match was mutated via the Path API
4. **Print** — Only the changed portions were reprinted; everything else came verbatim from the original

## Next Steps

- [Queries & Selectors](/transform/queries) — Learn the full selector syntax and query API
- [Path API](/transform/path-api) — Explore mutation, navigation, and comment methods
- [Writing a Codemod](/guides/writing-a-codemod) — A deeper dive into codemod patterns
