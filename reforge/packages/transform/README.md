# @reforge/transform

A query API and file runner for AST-based codemods.

## Quick Features

- CSS-style selector queries — select nodes with attribute constraints like `"FunctionDeclaration[async]"`
- Chainable query API — lazy execution with `.where()`, `.find()`, `.mutate()`, `.remove()`
- Path navigation — `closest()`, `siblings()`, `next()`, `prev()` with full mutation support
- Mutation recording — changes are batched and applied in a single reconciliation pass
- Comment and blank-line control — add, remove, and replace comments; manage leading/trailing newlines
- Node.js file runner — batch codemod execution with configurable concurrency and LCS-based diffs

## Usage

```ts
import { codemod } from "@reforge/transform/runner"

codemod({
  files: ["src/**/*.ts"],
  transform({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      p.node.moduleSpecifier = "lodash-es"
    })
  },
})
```

See [@reforge/core](../core) for the parsing and printing engine this builds on.
