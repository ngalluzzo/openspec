---
outline: [2, 3]
---

# Semantic Diffing

Generate human-readable "what changed" summaries after transformations.

## Overview

After a codemod runs, `semanticDiff()` compares the before and after ASTs to produce structured change descriptions:

```ts
import { semanticDiff, formatSemanticChanges } from "@reforge/core"

const changes = semanticDiff(beforeAst, afterAst, {
  adapter: tsAdapter,
  extractDeclarations,
})

const summary = formatSemanticChanges(changes, {
  adapter: tsAdapter,
})
// "Import renamed: 'lodash' → 'lodash-es'"
```

## Change Types

Semantic diffing detects these kinds of changes:

| Kind | Description |
|------|-------------|
| `rename` | A node was renamed (e.g., identifier, property) |
| `add` | A new node was added |
| `remove` | A node was removed |
| `move` | A node moved to a different location |

## How It Works

1. **Declaration extraction** — Top-level declarations (imports, functions, classes, interfaces, types, enums, variables) are extracted from both ASTs
2. **Fingerprint comparison** — Nodes are compared by serializing their scalar properties (not children) to detect what changed
3. **Change classification** — Differences are classified as renames, additions, removals, or moves
4. **Formatting** — Human-readable descriptions are generated using the adapter's `typeOf()` method

## TypeScript Adapter Support

The TypeScript adapter exports `extractDeclarations()` for precise declaration extraction:

```ts
import { extractDeclarations } from "@reforge/adapters/typescript"

const declarations = extractDeclarations(ast, source)
// [{ kind: "import", name: "lodash", source: "lodash-es", line: 1, text: "import lodash from 'lodash'" }, ...]
```

This is far more accurate than regex-based extraction and handles edge cases like:
- Named vs default imports
- Namespace imports (`import * as X`)
- Re-export declarations (skipped)
- Multi-variable declarations

## Using in Recipes

The recipes package uses semantic diffing automatically after running recipes:

```ts
import { runRecipes } from "@reforge/recipes"

const report = await runRecipes({
  recipes: [myRecipe],
  files: ["src/**/*.ts"],
})

// Each file summary includes semantic change descriptions
for (const file of report.files) {
  for (const change of file.changes) {
    console.log(change.description)
    // "Import renamed: 'lodash' → 'lodash-es'"
  }
}
```

## Report Formatting

Reports can be formatted as Markdown (for PR descriptions) or JSON (for CI):

```ts
console.log(report.toMarkdown())
// # Codemod Report\n\n## Changes\n\n### src/utils/helpers.ts\n- Import renamed: 'lodash' → 'lodash-es'

console.log(report.toJson())
// { files: [...], changes: [...], warnings: [...] }
```
