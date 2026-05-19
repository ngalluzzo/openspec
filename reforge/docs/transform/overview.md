---
outline: [2, 3]
---

# Overview

`@reforge/transform` provides a jQuery-like query API for AST mutation and a file runner for batch codemod execution.

## Two Parts

### Query API (`@reforge/transform`)

Select nodes with CSS-style selectors, navigate the tree via `Path` objects, record mutations during traversal, and apply them in a single reconciliation pass.

```ts
import { createQuery } from "@reforge/transform"

const result = parse(source, { adapter: tsAdapter })
const query = createQuery(result)

query.find("ImportDeclaration[moduleSpecifier=lodash]")
  .mutate((path) => {
    ;(path.node).moduleSpecifier = "lodash-es"
  })
```

### Runner (`@reforge/transform/runner`)

Run codemods across files with configurable concurrency, dry-run mode, and LCS-based diffs.

```ts
import { codemod } from "@reforge/transform/runner"

const summary = await codemod({
  include: ["src/**/*.ts"],
  adapterFor: () => tsAdapter,
  async transform({ query }) {
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
      ;(p.node).moduleSpecifier = "lodash-es"
    })
  },
})
```

## Key Design Decisions

### Lazy Query Execution

Nothing touches the AST until a terminal operation is called. Queries build up stages (find, where, closest) and execute in one pass:

```ts
// Nothing happens yet — stages are recorded
const q = query.find("FunctionDeclaration").where((p) => p.parent?.type === "ClassBody")

// Terminal operation — now the AST is traversed and mutations applied
q.mutate((path) => { /* ... */ })
```

### Mutation Recording + Reconciliation

Mutations are recorded as `MutationRecord` intents during traversal, then applied in a single reconciliation pass. This prevents mid-walk mutations from corrupting traversal order.

Reconciliation rules:
- Removes/replacements processed before insertions
- Array operations work back-to-front to preserve indices

### Selector DSL

A deliberate subset of CSS attribute selector syntax:

```ts
// Select all function declarations
query.find("FunctionDeclaration")

// Select async functions
query.find("FunctionDeclaration[async]")

// Select calls to require()
query.find("CallExpression[callee.name=require]")

// Select imports from a specific module
query.find("ImportDeclaration[moduleSpecifier=lodash]")
```

Dot-notation resolves nested properties:
```ts
query.find("ImportDeclaration[moduleSpecifier.type=Literal]")
```

### Runner Separated from Core

The runner entrypoint (`@reforge/transform/runner`) pulls in Node.js `fs`/`path` APIs, kept separate to avoid bundling them into browser builds.

## Architecture

```
createQuery() → QueryBuilder → QueryResult (chainable)
                    ↓
               Path<TNode> (wrapped node with mutation API)
                    ↓
              reconcile() (applies all recorded mutations)
                    ↓
               print() (format-preserving output)
```
