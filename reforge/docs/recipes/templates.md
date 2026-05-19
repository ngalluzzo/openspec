---
outline: [2, 3]
---

# Templates

Plan/apply scaffolding: produce file descriptors, create a deterministic write
plan, optionally apply it, then wire files into the codebase.

## defineTemplate()

Templates extend recipes with a `generate()` phase:

```ts
import { defineTemplate, runTemplates } from "@reforge/recipes"

const addComponent = defineTemplate({
  name: "component/add-button",
  displayName: "Add Button component",
  description: "Creates a new Button component and wires it into the app",

  /** Phase 1: Produce file descriptors */
  generate(vars) {
    return [{
      path: "src/components/Button.tsx",
      content: `
import React from 'react'

export function Button({ label }: { label: string }) {
  return <button>{label}</button>
}
`.trim(),
    }]
  },

  /** Phase 2: Wire generated files into existing code */
  run({ query, snippet }) {
    // Add import for the new component
    const importStmt = snippet('import { Button } from "./components/Button"')
    query.find("Program").first()?.insertBefore(importStmt)
  },
})
```

## Template Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| All Recipe properties | — | Yes | Same as recipes |
| `generate` | `(vars) => GeneratedFile[]` | Yes | Produce files to create |

## GeneratedFile

```ts
interface GeneratedFile {
  /** Path relative to project root */
  path: string

  /** Raw file content */
  content: string
}
```

## runTemplates()

Execute templates through plan/apply generation plus wiring:

```ts
const result = await runTemplates({
  templates: [addComponent],
  variables: { name: "SubmitButton" },
  projectRoot: ".",
  include: ["src/**/*.tsx"],
  adapterFor: (filePath) => tsAdapterFor(filePath),
  mode: "apply",
  existingFilePolicy: "fail",
})
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `templates` | `Template[]` | Templates to run |
| `variables` | `Record<string, unknown>` | Variables passed to generate() and run() |
| `mode` | `"plan" \| "apply"` | Plan only, or apply before wiring |
| `existingFilePolicy` | `"fail" \| "skip" \| "replace"` | Required policy for existing generated files |

### Result

```ts
type RunTemplatesResult = {
  /** Generation plan and optional apply result */
  generate: {
    plan: GeneratePlan
    apply: GenerateApplyResult | null
  }

  /** Recipe report from phase 2 (wiring) */
  wire: RecipeReport
}
```

## Execution Order

Per template invocation:

1. **generate(vars)** — Each template's `generate()` is called, producing `GeneratedFile[]`
2. **Plan** — Paths, collisions, policy decisions, and expected file state are recorded
3. **Apply** — In apply mode, the plan is preflighted and written if still safe
4. **run(ctx)** — All templates run as recipes, wiring generated files into existing code
5. **Semantic diff** — Changes are summarized and reported

## Existing Files

Existing file behavior is controlled by `existingFilePolicy`, not by individual
generated files.

```ts
await runTemplates({ /* ... */, mode: "apply", existingFilePolicy: "fail" })
await runTemplates({ /* ... */, mode: "apply", existingFilePolicy: "skip" })
await runTemplates({ /* ... */, mode: "apply", existingFilePolicy: "replace" })
```

To preview without writing generated files:

```ts
const result = await runTemplates({
  /* ... */
  mode: "plan",
  existingFilePolicy: "fail",
})

console.log(result.generate.plan.items)
```

## Template Variables

Templates accept typed variables:

```ts
defineTemplate<{
  name: string
  componentType?: "class" | "function"
}>({
  name: "component/create",
  options: {
    name: { type: "string", required: true, description: "Component name" },
    componentType: { type: "string", default: "function", description: "Component type" },
  },
  generate(vars) {
    const kind = vars.componentType || "function"
    return [{
      path: `src/components/${vars.name}.tsx`,
      content: `export ${kind} ${vars.name}() { return null }`,
    }]
  },
})
```

## Template vs Recipe

| Feature | Recipe | Template |
|---------|--------|----------|
| Runs per file | Yes | No (runs once per project) |
| generate() phase | No | Yes |
| run() phase | Yes | Yes (wiring) |
| Use case | Transform existing code | Scaffold new files + wire them in |

A template is a recipe with an extra generation phase. The `isTemplate()` type guard checks:

```ts
import { isTemplate } from "@reforge/recipes"

if (isTemplate(recipe)) {
  // recipe has a generate() method
}
```
