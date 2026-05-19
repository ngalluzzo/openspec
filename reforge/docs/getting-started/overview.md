---
outline: [2, 3]
---

# Overview

Reforge is a TypeScript framework for **format-preserving code transformations**. It lets you write codemods that mutate ASTs while keeping your original formatting, comments, and whitespace intact.

## The Problem with Traditional Codemods

Most codemod tools (jscodeshift, ts-morph transforms) reprint the entire file after mutations. This means:

- Your carefully formatted code gets reformatted
- Comments can be lost or moved
- Diff noise makes PR reviews harder
- You lose the human touch that makes code readable

## The Reforge Solution

Reforge uses a **shadow-copy** approach:

1. Parse source code into an AST, recording every node's original source slice in a side-channel index
2. Mutate the AST using a jQuery-like query API
3. Print back — unmodified nodes are emitted **verbatim** from the original source, only changed portions are reprinted

The result: your codemod changes exactly what you intend, and nothing else.

## How It Works

```
Source Code → parse() → AST (with shadow-copy) → mutate via query API → print() → Output
```

The system is layered:

| Package | Role |
|---------|------|
| `@reforge/core` | Parsing, printing, shadow-copy engine |
| `@reforge/transform` | Query API (CSS-style selectors) + file runner |
| `@reforge/adapters` | Language-specific parser adapters (TypeScript, CSS) |
| `@reforge/recipes` | High-level recipe composition, lint rules, templates |
| `@reforge/cli` | Command-line interface for running codemods |

## Quick Example

```ts
import { codemod } from "@reforge/transform/runner"
import { tsAdapter } from "@reforge/adapters/typescript"

codemod({
  include: ["src/**/*.ts"],
  adapterFor: () => tsAdapter,
  async transform({ query }) {
    // Replace all lodash imports with lodash-es
    query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
      ;(path.node).moduleSpecifier = "lodash-es"
    })
  },
})
```

Run it with the CLI:

```bash
reforge -t ./my-transform.ts "src/**/*.ts"
```

## Why "Reforge"?

Like a blacksmith reshaping metal without losing its form — reforge changes your code while preserving what makes it yours.
