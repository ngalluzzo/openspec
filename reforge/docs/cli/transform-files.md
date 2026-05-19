---
outline: [2, 3]
---

# Transform Files

Writing transform files for the reforge CLI.

## Basic Structure

A transform file exports a default function that receives the transformation context:

```ts
type TransformContext = {
  /** Query builder — CSS-style selectors and chainable mutations */
  query: import("@reforge/transform").QueryBuilder<any>

  /** Absolute path to the file being processed */
  filePath: string

  /** Parse a code snippet into an AST node for insertion */
  snippet: (source: string) => any
}

export default function transform({ query, filePath, snippet }: TransformContext) {
  // Your transformation logic
}
```

## The Query Builder

The `query` object provides the full query API:

```ts
export default function transform({ query }) {
  // Find all import declarations from lodash
  const imports = query.find("ImportDeclaration[moduleSpecifier=lodash]")

  // Mutate each match
  imports.mutate((path) => {
    ;(path.node).moduleSpecifier = "lodash-es"
  })
}
```

## Using snippet()

Parse code snippets to create nodes for insertion:

```ts
export default function transform({ query, snippet }) {
  // Create a new import statement node
  const newImport = snippet('import { debounce } from "lodash-es"')

  // Insert it at the top of each file
  query.find("Program").first()?.insertBefore(newImport)
}
```

## Using filePath()

Access the current file path for conditional logic:

```ts
export default function transform({ query, filePath }) {
  // Only transform files in the src/ directory
  if (!filePath.includes("src/")) return

  // Only transform files that contain a specific pattern
  if (!filePath.endsWith(".ts")) return
}
```

## Multiple Transformations

Chain multiple transformations in a single transform function:

```ts
export default function transform({ query }) {
  // 1. Replace lodash imports with lodash-es
  query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
    ;(p.node).moduleSpecifier = "lodash-es"
  })

  // 2. Rename forEach to each
  query.find("CallExpression[callee.name=forEach]").mutate((p) => {
    ;(p.node).callee.name = "each"
  })

  // 3. Remove unused imports (simple check)
  query.find("ImportDeclaration").forEach((importPath) => {
    const specifier = (importPath.node).moduleSpecifier
    if (specifier === "unused-package") {
      importPath.remove()
    }
  })
}
```

## Conditional Logic

Use the query API's filtering capabilities:

```ts
export default function transform({ query }) {
  // Only async functions with more than 3 parameters
  query.find("FunctionDeclaration[async]").where((path) => {
    const params = (path.node).params
    return Array.isArray(params) && params.length > 3
  }).mutate((path) => {
    // Add a JSDoc comment to complex async functions
    path.addLeadingComment("/** Complex async function — consider simplifying */")
  })
}
```

## Export Variants

The CLI accepts three export styles:

### Default export (recommended)
```ts
export default function transform({ query }) { /* ... */ }
```

### Named export
```ts
export function transform({ query }) { /* ... */ }
```

### Module as function
```ts
// The module itself is the transform function
export default ({ query }) => {
  /* ... */
}
```

## Best Practices

1. **Keep transforms focused** — One transform file per migration goal
2. **Use dry-run first** — Always preview with `--dry-run` before applying
3. **Be specific in selectors** — Use attribute constraints to avoid unintended matches
4. **Test on a small subset** — Run against a single file first: `reforge -t ./transform.ts "src/utils/helpers.ts"`
5. **Use snippet() for new nodes** — Parse snippets rather than building AST nodes manually
