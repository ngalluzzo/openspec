---
outline: [2, 3]
---

# Running Recipes

Execute recipes across files with dependency planning, concurrency, and structured reporting.

## runRecipes()

The main execution engine:

```ts
import { defineRecipe, runRecipes } from "@reforge/recipes"
import { tsAdapter } from "@reforge/adapters/typescript"

const myRecipe = defineRecipe({
  name: "migrate/lodash",
  run({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})

const report = await runRecipes({
  recipes: [myRecipe],
  files: ["src/**/*.ts"],
  adapterFor: () => tsAdapter,
})
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `recipes` | `RecipeRef[]` | Recipes to run (can include bound recipes) |
| `files` | `string[]` | Glob patterns for files to process |
| `adapterFor` | `(filePath) => ParserAdapter` | Resolve adapter by file path |
| `concurrency` | `number` | Max parallel file processors (default: 8) |
| `dryRun` | `boolean` | Preview without writing |
| `onResult` | `(result) => void` | Callback per file result |

## Dependency Planning

Recipes with `precipes` are automatically ordered via topological sort:

```ts
const base = defineRecipe({ name: "base", run() {} })
const middle = defineRecipe({ name: "middle", precipes: [base], run() {} })
const top = defineRecipe({ name: "top", precipes: [middle], run() {} })

// Execution order: base → middle → top (per file)
await runRecipes({ recipes: [top], files: ["src/**/*.ts"] })
```

### Deduplication

If the same recipe appears multiple times (directly or via precipes), it runs once with options from its first appearance:

```ts
// normalize appears in both precipes arrays — runs once, with options from top's declaration
await runRecipes({
  recipes: [
    defineRecipe({ name: "top", precipes: [normalize, middle] }),
    defineRecipe({ name: "middle", precipes: [normalize] }),
  ],
})
```

### Cycle Detection

Cycles in the dependency graph are detected and reported:

```ts
// This will throw RecipeOptionsError with a cycle detection message
defineRecipe({ name: "a", precipes: [b] })
defineRecipe({ name: "b", precipes: [a] }) // Cycle: a → b → a
```

## Single Parse Per File

All recipes sharing a file use the same `ParseResult`. Mutations are accumulated and applied in one print pass:

```
File A: Recipe1 (parse) → mutations → Recipe2 (same ParseResult) → mutations → print()
```

This is significantly more efficient than running each recipe as a separate codemod pass.

## Reporter API

The `report` object in the recipe context provides structured change tracking:

```ts
run({ query, report }) {
  // Record a specific change with explanation
  report.change("Import renamed: 'lodash' → 'lodash-es'")

  // Non-fatal warning — shown in report but doesn't fail
  report.warn("File has no tests — verify manually")

  // Flag for manual follow-up after the transform
  report.needsReview("Complex type changes — review manually")
}
```

## Report Output

### Markdown (for PR descriptions)

```ts
console.log(report.toMarkdown())
```

Output:
```
# Codemod Report

## Summary
- Files processed: 42
- Changed: 15
- Unchanged: 27

## Changes

### src/utils/helpers.ts
- Import renamed: 'lodash' → 'lodash-es'
- Function renamed: forEach → each

### src/services/api.ts  
- Import added: { debounce } from 'lodash-es'
```

### JSON (for CI)

```ts
console.log(report.toJson())
```

Output:
```json
{
  "files": [
    {
      "filePath": "src/utils/helpers.ts",
      "changes": [
        { "description": "Import renamed: 'lodash' → 'lodash-es'" },
        { "description": "Function renamed: forEach → each" }
      ],
      "warnings": [],
      "needsReview": []
    }
  ],
  "summary": { "total": 42, "changed": 15, "unchanged": 27 }
}
```

## Recipe Context

The `run()` function receives a context:

```ts
type RecipeContext<TOptions> = {
  /** Source code of the file being processed */
  source: string

  /** Absolute path to the file */
  filePath: string

  /** Resolved and validated options */
  options: TOptions

  /** Query builder — same API as the transform runner */
  query: QueryBuilder<any>

  /** Parse a snippet into a node for insertion */
  snippet: (source: string) => any

  /** Structured change reporting */
  report: Reporter
}
```
