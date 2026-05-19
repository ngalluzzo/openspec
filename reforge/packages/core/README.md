# @reforge/core

The parsing and printing engine for format-preserving code transformations.

## Quick Features

- Format-preserving print — unmodified source is emitted verbatim, only changed portions are reprinted
- Shadow-copy index — original source slices tracked via WeakMap, zero pollution on AST nodes
- Language-agnostic adapter interface — plug in any parser with a `ParserAdapter<TNode>`
- Comment and blank-line management — gap override system for precise whitespace control
- ASI hazard detection — automatic patching of Automatic Semicolon Insertion edge cases
- Semantic diffing — human-readable "what changed" summaries (renames, additions, removals)

## Usage

```ts
import { parse, print } from "@reforge/core"
import { tsAdapter } from "@reforge/adapters/typescript"

const result = parse(source, { adapter: tsAdapter })
// ... mutate the AST ...
const output = print(result)
```

See [@reforge/transform](../transform) for the query API that builds on top of this engine.
