---
outline: [2, 3]
---

# Path API

The `Path` object wraps AST nodes with navigation, mutation, comment, and blank-line methods.

## What Is a Path?

A `Path<TNode>` is a wrapped node that provides context-aware operations:

```ts
query.find("FunctionDeclaration").mutate((path) => {
  // path is a Path<ts.Node>
})
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `node` | `TNode` | The wrapped AST node |
| `parent` | `TNode \| null` | The parent node |
| `parents()` | `TNode[]` | All ancestors, closest first |
| `key` | `string \| null` | The key of this node in its parent |
| `index` | `number \| null` | The index in the parent's array |
| `source` | `string \| null` | The original source slice for this node |

## Navigation

```ts
// Closest matching ancestor
const func = path.closest("FunctionDeclaration")

// Sibling nodes
const prev = path.prev()
const next = path.next()
path.siblings() // All siblings
```

## Mutation Recording

Mutations are recorded as intents and applied in a single reconciliation pass:

```ts
// Replace the current node with another
path.replaceWith(newNode)

// Remove the current node from its parent
path.remove()

// Insert a node before the current one
path.insertBefore(newNode)

// Insert a node after the current one
path.insertAfter(newNode)
```

## Blank-Line Control

Manage leading and trailing newlines:

```ts
// Set exact number of blank lines before/after a node
path.setBlankLinesBefore(2)
path.setBlankLinesAfter(1)

// Ensure at least N blank lines before/after
path.ensureBlankLineBefore()
path.ensureBlankLineAfter()

// Remove blank lines before/after
path.removeBlankLinesBefore()
path.removeBlankLinesAfter()
```

## Comment Reading

```ts
// Leading comments (before the node)
const leading = path.leadingComments()

// Trailing comments (after the node, before next sibling)
const trailing = path.trailingComments()

// All comments associated with this node
const all = path.comments()

// JSDoc comment, if present
const jsdoc = path.jsdoc()
```

## Comment Writing

```ts
// Add a leading comment (prepended to the gap before this node)
path.addLeadingComment("// TODO: refactor")

// Remove all leading comments
path.removeLeadingComments()

// Replace a matching leading comment
path.replaceLeadingComment(
  (c) => c.text.includes("old"),
  "// New comment"
)

// Set a trailing comment (replaces existing trailing comments)
path.setTrailingComment("// End of function")
```

## Complete Example

```ts
query.find("FunctionDeclaration[async]").mutate((path) => {
  // Add a JSDoc comment
  path.addLeadingComment("/** Async function — consider using await */")

  // Ensure blank line before this function
  path.ensureBlankLineBefore()

  // Replace the function body with a throw statement
  const newBody = snippet("throw new Error('Not implemented')")
  path.replaceWith(newBody)
})
```
