---
outline: [2, 3]
---

# Building Recipes

Compose multi-step migrations with dependency-ordered recipes.

## Scenario

A complex migration that requires multiple coordinated steps:
1. Normalize import ordering (base recipe)
2. Migrate lodash to lodash-es (depends on step 1)
3. Remove deprecated API usage (independent, can run in parallel)

## Step 1: Define Individual Recipes

```ts
import { defineRecipe } from "@reforge/recipes"

// Base recipe: normalize import order
const normalizeImports = defineRecipe({
  name: "normalize/import-order",
  displayName: "Normalize import order",
  description: "Sorts imports alphabetically within groups",
  run({ query }) {
    // Sort import declarations
    const imports = query.find("ImportDeclaration").all()
    imports.sort((a, b) => {
      const aModule = (a.node).moduleSpecifier
      const bModule = (b.node).moduleSpecifier
      return String(aModule).localeCompare(String(bModule))
    })
  },
})

// Migration recipe: depends on normalizeImports
const migrateLodash = defineRecipe({
  name: "migrate/lodash-to-es",
  displayName: "Migrate lodash to lodash-es",
  description: "Replaces all lodash imports with lodash-es",
  precipes: [normalizeImports],
  run({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})

// Independent recipe: no dependencies
const removeDeprecated = defineRecipe({
  name: "cleanup/deprecated-apis",
  displayName: "Remove deprecated API usage",
  description: "Removes calls to deprecated functions",
  run({ query, report }) {
    const matches = query.find("CallExpression[callee.name=deprecatedFunction]").all()
    if (matches.length > 0) {
      matches.forEach((p) => p.remove())
      report.change(`Removed ${matches.length} deprecated function call(s)`)
    }
  },
})
```

## Step 2: Run the Recipe Set

```ts
import { runRecipes } from "@reforge/recipes"
import { tsAdapter } from "@reforge/adapters/typescript"

const report = await runRecipes({
  recipes: [migrateLodash, removeDeprecated],
  files: ["src/**/*.ts"],
  adapterFor: () => tsAdapter,
})

console.log(report.toMarkdown())
```

## Step 3: Understand the Execution Order

For each file, recipes run in this order:

```
normalizeImports (precipes of migrateLodash)
migrateLodash
removeDeprecated (independent, runs after precipes are done)
```

The dependency planner ensures:
- `normalizeImports` runs before `migrateLodash`
- Both run before the file is printed (single parse, single print)
- `removeDeprecated` runs after all precipes complete

## Parameterised Recipes with .with()

Create reusable recipes with bound options:

```ts
const renameImport = defineRecipe({
  name: "rename/import",
  displayName: "Rename import source",
  description: "Renames an import source",
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

// Create bound recipes with specific options
const migrateLodash = renameImport.with({ from: "lodash", to: "lodash-es" })
const migrateUnderscore = renameImport.with({ from: "underscore", to: "lodash-es" })

await runRecipes({
  recipes: [migrateLodash, migrateUnderscore],
  files: ["src/**/*.ts"],
})
```

## Applicable Filters

Skip files early with `appliesTo`:

```ts
const migrateLodash = defineRecipe({
  name: "migrate/lodash",
  appliesTo({ source }) {
    // Fast string check — skip files that don't mention lodash
    return source.includes("lodash")
  },
  run({ query }) {
    // Only reached for files that contain "lodash"
  },
})
```

## Reporting Changes

Track changes with the reporter:

```ts
run({ query, report }) {
  const lodashImports = query.find("ImportDeclaration[moduleSpecifier=lodash]").all()
  
  if (lodashImports.length > 0) {
    report.change(`Migrated ${lodashImports.length} lodash import(s) to lodash-es`)
  }

  // Warn about potential issues
  const asyncFunctions = query.find("FunctionDeclaration[async]").all()
  if (asyncFunctions.length > 10) {
    report.warn(`File has ${asyncFunctions.length} async functions — verify error handling`)
  }

  // Flag for manual review
  const complexTypes = query.find("TypeLiteral").all()
  if (complexTypes.length > 5) {
    report.needsReview("Complex type changes — review manually")
  }
}
```

## Recipe Deduplication

If the same recipe appears multiple times, it runs once:

```ts
// normalizeImports appears in both precipes — runs only once per file
await runRecipes({
  recipes: [
    defineRecipe({ name: "a", precipes: [normalizeImports] }),
    defineRecipe({ name: "b", precipes: [normalizeImports] }),
  ],
})
```
