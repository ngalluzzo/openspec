---
outline: [2, 3]
---

# Overview

`@reforge/core` is the parsing and printing engine at the heart of the reforge framework. It provides a **shadow-copy** architecture that enables format-preserving transformations.

## The Shadow-Copy Engine

When you parse source code, reforge doesn't just build an AST — it records every node's original source text and location in a sealed index backed by a `WeakMap`. This means:

- AST nodes are never polluted with `.original` properties
- The original source is accessible for any node via its object identity
- Memory is automatically reclaimed when nodes are garbage collected

During printing, reforge walks the AST and emits unmodified subtrees as **verbatim source slices** from the original. Only modified nodes are reprinted using the adapter's printer.

## Core Concepts

### `ParserAdapter<TNode>`

The universal contract between reforge and any parser. Every language adapter implements this interface:

```ts
interface ParserAdapter<TNode> {
  parse(source: string, options?): TNode
  parseSnippet(source: string, options?): TNode
  walk(root: TNode, visitor: NodeVisitor<TNode>): void
  locate(node: TNode): SourceLocation | null
  typeOf(node: TNode): string
  print?(node: TNode): string
}
```

### `ParseResult<TNode>`

The output of `parse()` — contains the root AST node, source map, and original source text.

### PrintResult

The output of `print()` — contains the printed source, a source map mapping output positions back to original positions, and any warnings.

## Key Functions

| Function | Purpose |
|----------|---------|
| `parse(source, { adapter })` | Parse source into an AST with shadow-copy |
| `snippet(source, { adapter })` | Parse a code snippet (no surrounding context) |
| `print(result, options)` | Print AST back to source, preserving formatting |
| `semanticDiff(before, after)` | Generate human-readable change summaries |

## What Core Does NOT Do

- **No query API** — that's `@reforge/transform`
- **No file runner** — that's also `@reforge/transform`
- **No recipe system** — that's `@reforge/recipes`

Core is purely the engine. Everything else builds on top of it.
