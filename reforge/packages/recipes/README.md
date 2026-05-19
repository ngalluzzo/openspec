# @reforge/recipes

A high-level system for composing, running, and reporting on codemods.

## Quick Features

- Recipe composition — declare dependencies with `precipes` and run in topological order
- Lint rules — ESLint-compatible diagnostics with optional fix support
- Code scaffolding templates — generate files and wire them into the codebase in two phases
- Typed options validation — schemas with defaults, custom validators, and descriptive errors
- Single parse per file — all recipes on a file share one `ParseResult`, mutations applied in one print pass
- Semantic diffing — human-readable change summaries after transformation
- Report formatting — Markdown for PR descriptions, JSON for CI integrations
- Dependency planning — automatic topological sort with cycle detection and deduplication

## Usage

```ts
import { defineRecipe, runRecipes } from "@reforge/recipes"

const myRecipe = defineRecipe({
  name: "migrate-imports",
  run({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      p.node.moduleSpecifier = "lodash-es"
    })
  },
})

const report = await runRecipes({ recipes: [myRecipe], files: ["src/**/*.ts"] })
console.log(report.toMarkdown())
```

See [@reforge/transform](../transform) for the query API recipes use under the hood.
