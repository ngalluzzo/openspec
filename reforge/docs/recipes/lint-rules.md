---
outline: [2, 3]
---

# Lint Rules

ESLint-compatible lint rules with optional fix recipes and structured diagnostics.

## defineRule()

Create a lint rule:

```ts
import { defineRule, runRules } from "@reforge/recipes"

const noConsole = defineRule({
  name: "no-console",
  displayName: "No console statements",
  description: "Disallows console.log() calls",
  severity: "warning",

  /** Lint function — produces diagnostics, does NOT mutate AST */
  lint({ query }) {
    return query.find("CallExpression[callee.name=console]").map((path) => ({
      message: "Unexpected console statement",
      path,
    }))
  },

  /** Optional fix recipe — handles bulk fixing */
  fix({ query }) {
    query.find("CallExpression[callee.name=console]").remove()
  },
})
```

## Rule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Rule identifier |
| `displayName` | `string` | Yes | Human-readable name |
| `description` | `string` | Yes | What the rule checks |
| `severity` | `"error" \| "warning" \| "info"` | Yes | Default severity |
| `lint` | `(ctx) => LintDiagnostic[]` | Yes | Produce diagnostics |
| `fix` | `Recipe<any>` | No | Fix recipe for bulk fixing |

## LintDiagnostic

Each diagnostic includes:

```ts
interface LintDiagnostic {
  message: string                    // Human-readable description
  path: Path<any>                    // The offending node's path
  fix?: (path: Path<any>) => void    // Per-node quickfix for IDEs
  severity?: "error" | "warning" | "info"
}
```

## runRules()

Execute lint rules across files:

```ts
const result = await runRules({
  rules: [noConsole, noDebugger],
  files: ["src/**/*.ts"],
  adapterFor: () => tsAdapter,
})
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `rules` | `Rule[]` | Rules to run |
| `files` | `string[]` | Glob patterns for files |
| `adapterFor` | `(filePath) => ParserAdapter` | Adapter resolver |
| `severityOverrides` | `Record<string, LintSeverity>` | Override rule severities |
| `fix` | `boolean` | Run fix recipes for rules that have one |

### Result

```ts
type RunRulesResult = {
  /** Resolved diagnostics with location info */
  diagnostics: ResolvedDiagnostic[]

  /** ESLint-compatible JSON output */
  toEslintJson(): string
}
```

## ResolvedDiagnostic

Each diagnostic is resolved to a concrete location:

```ts
interface ResolvedDiagnostic {
  ruleId: string    // "no-console"
  ruleName: string  // "No console statements"
  severity: "error" | "warning" | "info"
  message: string   // "Unexpected console statement"
  filePath: string
  line: number
  column: number
  fixable: boolean  // Has a fix recipe or per-node fixer
}
```

## Changing Severity

Rules have an `.as()` method to change severity at the call site:

```ts
await runRules({
  rules: [
    noConsole.as("error"),   // Upgrade to error
    noDebugger.as("info"),   // Downgrade to info
  ],
})
```

## Rule-Recipe Duality

Rules satisfy the `Recipe` interface — they can be used anywhere a Recipe is used:

```ts
// As a lint rule (produces structured diagnostics)
await runRules({ rules: [noConsole] })

// As a recipe (diagnostics mapped to report.warn())
await runRecipes({ recipes: [noConsole] })

// As a fix recipe (the rule's fix is used)
await runRecipes({ recipes: [noConsole.fix!] })
```

## Complete Example

```ts
const noLodash = defineRule({
  name: "no-lodash",
  displayName: "No lodash imports",
  description: "Lodash is deprecated, use lodash-es instead",
  severity: "error",

  lint({ query }) {
    return query.find("ImportDeclaration[moduleSpecifier=lodash]", "ImportDeclaration[moduleSpecifier=lodash/fp]").map((path) => ({
      message: "Use 'lodash-es' instead of 'lodash'",
      path,
    }))
  },

  fix({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})

// Run with fix enabled
await runRules({
  rules: [noLodash],
  files: ["src/**/*.ts"],
  fix: true,
})
```
