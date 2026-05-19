---
outline: [2, 3]
---

# Runner

Run codemods across files with configurable concurrency, dry-run mode, and structured results.

## Overview

The runner (`@reforge/transform/runner`) handles file discovery, parsing, transformation, and writing:

```ts
import { codemod } from "@reforge/transform/runner"
import { tsAdapter } from "@reforge/adapters/typescript"

const summary = await codemod({
  include: ["src/**/*.ts"],
  exclude: ["**/*.test.ts"],
  concurrency: 8,
  dryRun: false,
  adapterFor: () => tsAdapter,
  async transform({ query, filePath, snippet }) {
    // Your transformation logic
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string[]` | — | Glob patterns for files to transform |
| `exclude` | `string[]` | `["**/node_modules/**", "**/.git/**"]` | Glob patterns to exclude |
| `concurrency` | `number` | `8` | Max parallel file processors |
| `dryRun` | `boolean` | `false` | Preview changes without writing |
| `adapterFor` | `(filePath) => ParserAdapter` | — | Resolve adapter by file path |
| `onResult` | `(result) => void` | — | Callback for each file result |
| `onError` | `(error) => void` | — | Callback for processing errors |

## Transform Context

Your transform function receives a context object:

```ts
type TransformContext = {
  /** Query builder — same API as createQuery() */
  query: QueryBuilder<any>

  /** Absolute path to the file being processed */
  filePath: string

  /** Parse a code snippet into a node for insertion */
  snippet: (source: string) => any
}
```

## File Results

Each file produces one of these result types:

| Kind | Description |
|------|-------------|
| `changed` | File was modified, contains `{ kind: "changed", output: string }` |
| `unchanged` | No mutations applied, file written as-is |
| `skipped` | File was skipped (e.g., didn't match applicability filter) |
| `error` | Processing failed, contains `{ kind: "error", error: Error }` |

## Summary

The runner returns a summary:

```ts
type CodemodSummary = {
  total: number      // Total files processed
  changed: number    // Files with mutations
  unchanged: number  // Files parsed but no changes
  skipped: number    // Files skipped
  errored: number    // Files that failed to process
  durationMs: number // Total wall-clock time
}
```

## Concurrency Pool

The runner uses a bounded-concurrency task pool. Files are processed in parallel up to the `concurrency` limit:

```ts
// Process 4 files at a time
codemod({
  include: ["src/**/*.ts"],
  concurrency: 4,
  // ...
})
```

## Error Handling

Errors during processing are caught and reported via the `onError` callback or the summary's `errored` count:

```ts
codemod({
  include: ["src/**/*.ts"],
  onError({ filePath, error }) {
    console.error(`Failed to process ${filePath}:`, error)
  },
})
```

## Dry Run Mode

Preview changes without writing to disk:

```ts
const summary = await codemod({
  include: ["src/**/*.ts"],
  dryRun: true,
  async transform({ query }) {
    // Mutations are recorded but files are not written
  },
})
// summary.changed shows what would change
```
