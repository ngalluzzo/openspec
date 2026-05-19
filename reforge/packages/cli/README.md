# @reforge/cli

Command-line interface for running reforge codemods.

## Quick Features

- Zero external dependencies — hand-rolled argument parser, no runtime deps beyond reforge packages
- Built-in adapter registry — auto-resolves TypeScript and CSS adapters by file extension
- Dry-run mode — preview changes without writing to disk
- Configurable concurrency — parallel file processing with adjustable worker count
- Diff output — LCS-based unified diffs for unchanged files in verbose mode
- ANSI color support — auto-detects TTY, respects `NO_COLOR` environment variable

## Usage

```bash
# Run a transform across TypeScript files
reforge -t ./my-transform.ts "src/**/*.ts"

# Dry run with verbose output
reforge -t ./my-transform.ts "src/**/*.ts" --dry-run -v

# Custom concurrency and extensions
reforge -t ./my-transform.ts "src/**/*.{ts,tsx}" -j 4 --ext ts,tsx
```

Transform files export a default function:

```ts
export default function ({ query, snippet }) {
  query.find("ImportDeclaration[moduleSpecifier=lodash]").mutate((p) => {
    p.node.moduleSpecifier = "lodash-es"
  })
}
```

See [@reforge/transform](../transform) for the runner this CLI wraps.
