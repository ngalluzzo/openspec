---
outline: [2, 3]
---

# Adapters

Language-specific parser adapters bridge the generic core engine to real parsers.

## The ParserAdapter Interface

Every adapter implements this contract:

```ts
interface ParserAdapter<TNode> {
  /** Language identifier for adapter resolution */
  language: string

  /** Parse full source code into an AST root */
  parse(source: string, options?): TNode

  /** Parse a standalone expression/snippet */
  parseSnippet(source: string, options?): TNode

  /** Walk the AST tree with enter/leave callbacks */
  walk(root: TNode, visitor: NodeVisitor<TNode>): void

  /** Get source location for a node */
  locate(node: TNode): SourceLocation | null

  /** Get the canonical type name of a node */
  typeOf(node: TNode): string

  /** Optional — reprint a node to source */
  print?(node: TNode): string
}
```

## Built-in Adapters

### TypeScript Adapter

```ts
import { tsAdapter } from "@reforge/adapters/typescript"
```

Uses the official TypeScript compiler API (`ts.createSourceFile`, `ts.Node` walker, `ts.createPrinter`). Supports `.ts`, `.tsx`, `.js`, `.jsx`.

```ts
const result = parse(source, { adapter: tsAdapter })
```

**Options:**
```ts
interface TsParseOptions {
  fileName?: string
  scriptKind?: ts.ScriptKind
}
```

**Re-exported TypeScript module:**
```ts
import { ts } from "@reforge/adapters/typescript"
ts.isFunctionDeclaration(node)
ts.SyntaxKind.FunctionDeclaration
```

### CSS Adapter

```ts
import { cssAdapter } from "@reforge/adapters/css"
```

Uses PostCSS for parsing and printing. Supports `.css`, `.scss`.

```ts
const result = parse(source, { adapter: cssAdapter })
```

PostCSS is loaded lazily via `require()` — it's a peer dependency and won't be bundled into browser builds.

## Writing a Custom Adapter

Create an adapter for any parser that produces an AST:

```ts
import type { ParserAdapter, NodeVisitor, SourceLocation } from "@reforge/core"

const myAdapter: ParserAdapter<MyNode> = {
  language: "mylang",

  parse(source: string): MyNode {
    return myParser.parse(source)
  },

  parseSnippet(source: string): MyNode {
    return myParser.parseExpression(source)
  },

  walk(root: MyNode, visitor: NodeVisitor<MyNode>): void {
    function visit(node: MyNode, parent: MyNode | null, key: string | null) {
      const ctrl = visitor.enter?.(node, parent, key)
      if (ctrl === "stop") return
      if (ctrl !== "skip" && node.children) {
        for (const child of node.children) {
          visit(child, node, "children")
        }
      }
      visitor.leave?.(node, parent, key)
    }
    visit(root, null, null)
  },

  locate(node: MyNode): SourceLocation | null {
    return {
      start: { offset: node.start, line: node.line, column: node.column },
      end: { offset: node.end, line: node.lineEnd, column: node.columnEnd },
    }
  },

  typeOf(node: MyNode): string {
    return node.type
  },

  print(node: MyNode): string {
    return myPrinter.print(node)
  },
}
```

## Adapter Resolution

The CLI and runner resolve adapters by file extension:

| Extension | Adapter |
|-----------|---------|
| `.ts`, `.tsx` | TypeScript adapter |
| `.js`, `.jsx` | TypeScript adapter (JSX mode) |
| `.mjs`, `.cjs` | TypeScript adapter (JS mode) |
| `.css`, `.scss` | CSS adapter |

For programmatic usage, pass `adapterFor` to specify which adapter handles each file:

```ts
codemod({
  include: ["src/**/*.{ts,css}"],
  adapterFor(filePath) {
    if (filePath.endsWith(".css")) return cssAdapter
    return tsAdapter
  },
})
```
