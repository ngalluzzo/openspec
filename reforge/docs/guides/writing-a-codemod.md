---
outline: [2, 3]
---

# Writing a Codemod

A complete walkthrough: from setup to running your first codemod.

## Scenario

You're migrating a codebase from `lodash` to `lodash-es`. This requires:
1. Replacing import sources
2. Renaming function calls (`forEach` → `each`)
3. Adding new imports for functions that only exist in `lodash-es`

## Step 1: Create the Transform File

Create `migrate-lodash.ts`:

```ts
type TransformContext = {
  query: import("@reforge/transform").QueryBuilder<any>
  filePath: string
  snippet: (source: string) => any
}

export default function transform({ query, snippet }: TransformContext) {
  // Step 1: Replace lodash import sources
  query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
    ;(path.node).moduleSpecifier = "lodash-es"
  })

  // Step 2: Replace lodash/fp import sources
  query.find("ImportDeclaration[moduleSpecifier=lodash/fp]").mutate((path) => {
    ;(path.node).moduleSpecifier = "lodash-es"
  })

  // Step 3: Rename forEach calls to each
  query.find("CallExpression[callee.name=forEach]").mutate((path) => {
    ;(path.node).callee.name = "each"
  })
}
```

## Step 2: Preview with Dry Run

```bash
reforge -t ./migrate-lodash.ts "src/**/*.ts" --dry-run -v
```

Output:
```
✓ src/utils/helpers.ts (3 changes)
  - ImportDeclaration: moduleSpecifier 'lodash' → 'lodash-es'
  - CallExpression callee: forEach → each
✓ src/services/api.ts (1 change)
  - ImportDeclaration: moduleSpecifier 'lodash' → 'lodash-es'
✗ src/components/Button.tsx (unchanged)

Summary: 2 changed, 1 unchanged, 0 errored
```

## Step 3: Apply Changes

```bash
reforge -t ./migrate-lodash.ts "src/**/*.ts"
```

## Step 4: Verify

Check the diff in your editor or with git:

```bash
git diff src/utils/helpers.ts
```

Expected output (format preserved):
```diff
- import _ from 'lodash'
+ import _ from 'lodash-es'

  function processItems(items) {
-   items.forEach(item => console.log(item))
+   items.each(item => console.log(item))
  }
```

## Advanced: Handling Edge Cases

### Named imports from lodash

```ts
// Before: import { debounce } from 'lodash'
// After:  import { debounce } from 'lodash-es'
query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
  ;(path.node).moduleSpecifier = "lodash-es"
})
```

### Namespace imports

```ts
// Before: import * as _ from 'lodash'
// After:  import * as _ from 'lodash-es'
query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((path) => {
  ;(path.node).moduleSpecifier = "lodash-es"
})
```

### Dynamic imports

```ts
// Before: import('lodash')
// After:  import('lodash-es')
query.find("ImportExpression[source.value=lodash]").mutate((path) => {
  ;(path.node).source.value = "lodash-es"
})
```

### Require calls

```ts
// Before: const _ = require('lodash')
// After:  const _ = require('lodash-es')
query.find("CallExpression[callee.name=require][arguments.0.value=lodash]").mutate((path) => {
  ;(path.node).arguments[0].value = "lodash-es"
})
```

## Tips

- **Test on a copy first** — Always run against a backup or uncommitted changes
- **Use `--dry-run` liberally** — Preview before applying
- **Be specific in selectors** — Use attribute constraints to avoid unintended matches
- **Check for side effects** — Some renames may break code if the new function has different behavior
- **Run tests after** — Format-preserving doesn't mean semantics-preserving; always verify behavior
