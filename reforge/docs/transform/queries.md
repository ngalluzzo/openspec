---
outline: [2, 3]
---

# Queries & Selectors

Select AST nodes using CSS-style selectors and chain mutations.

## Selector Syntax

Selectors use a subset of CSS attribute selector syntax:

```ts
query.find(selector)
```

### Basic Selectors

Select by node type:

```ts
// All function declarations
query.find("FunctionDeclaration")

// All import declarations
query.find("ImportDeclaration")

// All call expressions
query.find("CallExpression")
```

### Attribute Selectors

Filter by property values:

```ts
// Async functions only
query.find("FunctionDeclaration[async]")

// Calls to require()
query.find("CallExpression[callee.name=require]")

// Imports from lodash
query.find("ImportDeclaration[moduleSpecifier=lodash]")
```

### Nested Property Selectors

Dot-notation resolves nested properties:

```ts
// Import declarations where the specifier is a Literal node type
query.find("ImportDeclaration[moduleSpecifier.type=Literal]")

// Variable declarations with an initializer
query.find("VariableDeclaration[declarations.0.init]")
```

## Chainable Query API

Queries are lazy and chainable. Stages accumulate until a terminal operation is called.

### find()

Select nodes matching the selector:

```ts
query.find("FunctionDeclaration")
```

### findComments()

Select comments:

```ts
query.findComments("// TODO")
```

### where()

Filter by a predicate function:

```ts
query.find("FunctionDeclaration").where((path) => {
  return path.node.params.length > 2
})
```

### closest()

Walk up the tree to find the nearest matching ancestor:

```ts
query.find("Identifier[name=foo]").closest("FunctionDeclaration")
```

### Terminal Operations

These execute the query and apply results:

| Operation | Description |
|-----------|-------------|
| `.mutate(fn)` | Record a mutation for each matched path |
| `.remove()` | Remove each matched node |
| `.replaceWith(node)` | Replace each matched node |
| `.all()` | Return all matching paths (read-only) |
| `.first()` | Return the first matching path |
| `.count()` | Return number of matches |
| `.forEach(fn)` | Iterate over all matches |
| `.map(fn)` | Map over all matches |

## Mutation Recording

Mutations are recorded as intents during traversal, not applied immediately:

```ts
query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
  // This records an intent — the AST isn't mutated yet
  ;(path.node).moduleSpecifier = "lodash-es"
})
```

All recorded mutations are applied in a single reconciliation pass after traversal completes. This ensures:
- No mid-walk corruption of the traversal cursor
- Consistent ordering (removes/replacements before insertions)
- Correct index handling for array operations

## Examples

### Rename all lodash imports to lodash-es

```ts
query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
  ;(path.node).moduleSpecifier = "lodash-es"
})
```

### Find all unused imports

```ts
query.find("ImportDeclaration").forEach((importPath) => {
  const importedName = (importPath.node).specifiers[0].local.name
  const usageCount = source.split(importedName).length - 1
  if (usageCount === 1) {
    importPath.remove()
  }
})
```

### Wrap function bodies with a logging statement

```ts
query.find("FunctionDeclaration").mutate((path) => {
  const logStmt = snippet('console.log("entering", arguments)')
  path.insertBefore(logStmt)
})
```
