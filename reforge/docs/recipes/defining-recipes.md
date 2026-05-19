---
outline: [2, 3]
---

# Defining Recipes

Create composable codemods with typed options, dependency ordering, and applicability filters.

## defineRecipe()

The primary recipe authoring API:

```ts
import { defineRecipe } from "@reforge/recipes"

const myRecipe = defineRecipe({
  name: "org/scope/recipe-name",
  displayName: "Human-readable Name",
  description: "What this recipe does",
  tags?: ["migration", "typescript"],

  /** Typed options with validation */
  options: {
    from: { type: "string", required: true, description: "Original value" },
    to: { type: "string", required: true, description: "New value" },
  },

  /** Recipes that run before this one */
  precipes?: [otherRecipe],

  /** Fast filter — skip file cheaply before parsing */
  appliesTo({ source, filePath }) {
    return source.includes("lodash")
  },

  /** The transformation logic */
  run({ query, snippet, options, report }) {
    const selector = `ImportDeclaration[moduleSpecifier=${options.from}]`
    query.find(selector).mutate((path) => {
      ;(path.node).moduleSpecifier = options.to
    })
  },
})
```

## Recipe Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Namespaced identifier (e.g., `"org/scope/name"`) |
| `displayName` | `string` | Yes | Human-readable name for reports |
| `description` | `string` | Yes | What the recipe does |
| `tags` | `string[]` | No | Tags for filtering/searching |
| `options` | `OptionsSchema<T>` | No | Typed options with validation |
| `precipes` | `RecipeRef[]` | No | Dependencies that run before this recipe |
| `appliesTo` | `(ctx) => boolean` | No | Fast applicability filter |
| `run` | `(ctx) => RecipeResult` | Yes | The transformation logic |

## Options Schema

Options are validated before `run()` is called:

```ts
type OptionType = "string" | "number" | "boolean" | "string[]"

interface OptionDef {
  type: OptionType
  description: string
  required?: boolean
  default?: unknown
  validate?: (value: unknown) => void // Custom validator — throw to reject
}
```

### Built-in Types

```ts
options: {
  // String option, required
  moduleName: { type: "string", required: true, description: "Module name to rename" },

  // Number with default
  maxDepth: { type: "number", default: 10, description: "Maximum nesting depth" },

  // Boolean flag
  dryRun: { type: "boolean", default: false, description: "Preview without writing" },

  // Array of strings
  extensions: { type: "string[]", default: ["ts", "tsx"], description: "File extensions to process" },
}
```

### Custom Validation

```ts
options: {
  port: {
    type: "number",
    required: true,
    description: "Server port",
    validate: (value) => {
      if (typeof value !== "number" || value < 1 || value > 65535) {
        throw new Error("Port must be between 1 and 65535")
      }
    },
  },
}
```

## Recipe Composition with precipes

Recipes can declare dependencies that run before them:

```ts
const normalizeImports = defineRecipe({
  name: "normalize/imports",
  run({ query }) {
    // Normalize import order
  },
})

const migrateImports = defineRecipe({
  name: "migrate/lodash",
  precipes: [normalizeImports], // normalize runs first
  run({ query }) {
    // Migrate imports
  },
})
```

### Binding Options with .with()

Recipes have a `.with()` method to create bound copies with pre-filled options:

```ts
const renameImport = defineRecipe({
  name: "rename/import",
  options: {
    from: { type: "string", required: true },
    to: { type: "string", required: true },
  },
  run({ options, query }) {
    // ...
  },
})

// Create a bound recipe with options pre-filled
const migrateLodash = renameImport.with({ from: "lodash", to: "lodash-es" })

// Use in precipes for parameterised composition
const complexRecipe = defineRecipe({
  name: "complex",
  precipes: [migrateLodash, normalizeImports],
  run() {},
})
```

## Applicability Filter

The `appliesTo` function is called before parsing — return `false` to skip the file cheaply:

```ts
appliesTo({ source, filePath }) {
  // Simple string search is fast — saves parsing time on large codebases
  return source.includes("lodash") || filePath.includes("import-map")
}
```

## Recipe Result

The `run()` function can return:

| Return Type | Description |
|-------------|-------------|
| `void` | No change description needed |
| `string` | Single change description |
| `string[]` | Multiple change descriptions |

```ts
run({ query, report }) {
  const matches = query.find("ImportDeclaration[moduleSpecifier=lodash]").all()
  if (matches.length > 0) {
    return `Replaced ${matches.length} lodash import(s)`
  }
}
```
