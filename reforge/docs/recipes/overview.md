---
outline: [2, 3]
---

# Overview

`@reforge/recipes` provides a high-level system for composing, running, and reporting on codemods.

## Three Systems

### Recipes

Composable, dependency-ordered codemods with typed options and structured reporting:

```ts
import { defineRecipe, runRecipes } from "@reforge/recipes"

const migrateImports = defineRecipe({
  name: "migrate/lodash-to-lodash-es",
  displayName: "Migrate lodash to lodash-es",
  description: "Replaces all lodash imports with lodash-es",
  run({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})

const report = await runRecipes({
  recipes: [migrateImports],
  files: ["src/**/*.ts"],
})
```

### Lint Rules

ESLint-compatible lint rules with optional fix recipes:

```ts
import { defineRule, runRules } from "@reforge/recipes"

const noConsole = defineRule({
  name: "no-console",
  displayName: "No console statements",
  description: "Disallows console.log() calls",
  severity: "warning",
  lint({ query }) {
    return query.find("CallExpression[callee.name=console]").map((p) => ({
      message: "Unexpected console statement",
      path: p,
    }))
  },
})

const result = await runRules({
  rules: [noConsole],
  files: ["src/**/*.ts"],
})
```

### Templates

Two-phase scaffolding: generate files, then wire them into the codebase:

```ts
import { defineTemplate, runTemplates } from "@reforge/recipes"

const addComponent = defineTemplate({
  name: "component/add-button",
  displayName: "Add Button component",
  description: "Creates a new Button component and wires it into the app",
  generate({ vars }) {
    return [{
      path: "src/components/Button.tsx",
      content: `export function Button() { return <button>{vars.label}</button> }`,
    }]
  },
  run({ query, snippet }) {
    // Wire the generated component into the app's imports
  },
})
```

## Key Features

### Dependency Planning

Recipes declare dependencies via `precipes` that run before them. The dependency graph is topologically sorted with cycle detection:

```ts
const baseRecipe = defineRecipe({ name: "base", run() {} })
const derivedRecipe = defineRecipe({
  name: "derived",
  precipes: [baseRecipe], // base runs first
  run() {},
})
```

### Single Parse Per File

All recipes sharing a file use the same `ParseResult`. Mutations are accumulated and applied in one print pass — no redundant parsing or printing.

### Typed Options

Recipes and rules accept typed options with validation:

```ts
defineRecipe({
  name: "rename-import",
  options: {
    from: { type: "string", required: true, description: "Original import source" },
    to: { type: "string", required: true, description: "New import source" },
  },
  run({ options, query }) {
    const selector = `ImportDeclaration[moduleSpecifier=${options.from}]`
    query.find(selector).mutate((p) => {
      ;(p.node).moduleSpecifier = options.to
    })
  },
})
```

### Structured Reporting

Reports support Markdown (for PR descriptions) and JSON (for CI) output:

```ts
console.log(report.toMarkdown())
// # Codemod Report\n\n## Changes\n\n### src/utils/helpers.ts\n- Import renamed: 'lodash' → 'lodash-es'

console.log(report.toJson())
// { files: [...], changes: [...], warnings: [...] }
```
