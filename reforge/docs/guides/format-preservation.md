---
outline: [2, 3]
---

# Format Preservation

A deep dive into how reforge preserves formatting, comments, and whitespace.

## The Problem

Traditional codemods reprint the entire file after mutations. This means:
- Custom indentation styles are lost
- Comments can be reordered or removed
- Blank lines between sections disappear
- Diff noise makes code reviews harder

## The Shadow-Copy Solution

Reforge records every node's original source slice during parsing, then emits unmodified subtrees verbatim.

### How It Works

```
Original Source:          Shadow-Copy Index:
─────────────            ─────────────────
type Foo = {             Node A → "type Foo = {\n"
  bar: string            Node B → "bar: string"
}                        Node C → "\n"
                         Node D → "}"
                         
         ↓

Parse:                    During Print:
type Foo = {    → AST     Node A unchanged → emit "type Foo = {\n"
  bar: string   → +       Node B changed   → reprint "bar: number"
}                   index  Node C unchanged → emit "\n"
                                 Node D unchanged → emit "}"

Result:               Output:
type Foo = {          type Foo = {
  bar: number          bar: number
}                      }
```

### WeakMap Storage

The shadow-copy index uses a `WeakMap` keyed by node object identity:

```ts
class OriginalSourceMap<TNode> {
  private map = new WeakMap<object, SourceSlice>()

  set(node: TNode, slice: SourceSlice): void {
    this.map.set(node as object, slice)
  }

  get(node: TNode): SourceSlice | undefined {
    return this.map.get(node as object)
  }
}
```

Benefits:
- No pollution of AST nodes with `.original` properties
- Automatic memory reclamation when nodes are garbage collected
- No need to manually clean up the index

## Gaps: Whitespace Between Nodes

Gaps are the whitespace and comments between AST nodes. They're not part of any node — they live in the spaces.

### Gap Structure

```
type Foo = {
  ↑gap↑                ↑gap↑
  "\n  "               "\n"
  bar: string   baz: number
}
```

Each gap can contain:
- Leading newlines (blank lines before a node)
- Trailing comments
- Inline whitespace (spaces, tabs)

### Gap Override Map

Instead of manipulating fake comment nodes in the AST, reforge uses a side-channel map:

```ts
const gapOverrides = createGapOverrideMap()
gapOverrides.set(node, {
  leading: setLeadingNewlines(2),
})
```

This is applied during printing via `applyGapOverride()`.

## Comment Management

Comments are stored in gaps, not as AST nodes:

```ts
// This comment lives in the gap before 'bar'
type Foo = {
  // leading comment
  bar: string   // trailing comment
}
```

### Reading Comments

```ts
import { parseGapComments, findJsdoc } from "@reforge/core"

const comments = parseGapComments(gapText, baseOffset)
const jsdoc = findJsdoc(comments)
```

### Writing Comments

```ts
import { prependCommentToGap, stripCommentsFromGap } from "@reforge/core"

gapText = prependCommentToGap(gapText, "// New comment")
gapText = stripCommentsFromGap(gapText)
```

## ASI Safety

After printing, reforge runs a post-pass to detect and patch Automatic Semicolon Insertion hazards:

### Common ASI Hazards

```ts
// Before mutation:          After mutation (without patching):
const a = 1                 const a = 1
const b = 2                 (function() { })()
(function() { })()          // → a is called as a function!

// Patched:                  const a = 1;
const a = 1;                const b = 2
const b = 2                 (function() { })()
```

### Detection and Patching

```ts
import { isAsiHazard, patchGap } from "@reforge/core"

if (isAsiHazard(prevSlice, nextSlice)) {
  const safeGap = patchGap(gap)
}
```

## Fingerprint-Based Mutation Detection

Reforge determines if a node changed by comparing its "fingerprint" — a serialization of scalar properties (not children):

```ts
function getFingerprint(node: any): string {
  const scalars = {}
  for (const key of Object.keys(node)) {
    if (typeof node[key] !== "object" || node[key] === null) {
      scalars[key] = node[key]
    }
  }
  return JSON.stringify(scalars)
}
```

If the fingerprint matches the original, the node is emitted verbatim.

## Source Map Generation

`print()` returns a source map mapping output positions back to original positions:

```ts
const { source, map } = print(result)
// map: SourceMapV3 — standard VLQ-encoded source map
```

This enables:
- Editor integrations (go to definition, hover)
- Error reporting with accurate line numbers
- Debugging transformed code against original source
