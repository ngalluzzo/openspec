---
outline: [2, 3]
---

# CLI Overview

The reforge command-line interface for running codemods.

## Installation

```bash
npm install @reforge/core @reforge/transform @reforge/adapters @reforge/cli
```

## Usage

```bash
reforge -t <transform-file> [patterns...] [options]
```

## Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--transform <file>` | `-t` | Transform file (required) |
| `--dry-run` | `-d` | Preview without writing |
| `--concurrency <n>` | `-j` | Parallel workers (default: 8) |
| `--ext <exts>` | — | Extensions to process (default: ts,tsx,js,jsx,mjs,cjs) |
| `--ignore <glob>` | `-i` | Exclude pattern (repeatable) |
| `--verbose` | `-v` | Show unchanged files and diffs |
| `--help` | `-h` | Help text |
| `--version` | — | Version number |

## Examples

### Basic usage

```bash
reforge -t ./migrate-imports.ts "src/**/*.ts"
```

### Dry run with verbose output

```bash
reforge -t ./migrate-imports.ts "src/**/*.ts" --dry-run -v
```

### Custom concurrency and extensions

```bash
reforge -t ./transform.ts "src/**/*.{ts,tsx}" -j 4 --ext ts,tsx
```

### Multiple ignore patterns

```bash
reforge -t ./transform.ts "src/**/*.ts" -i "**/*.test.ts" -i "**/__fixtures__/**"
```

## Transform File Format

Transform files export a default function:

```ts
type TransformContext = {
  query: import("@reforge/transform").QueryBuilder<any>
  filePath: string
  snippet: (source: string) => any
}

export default function transform({ query, filePath, snippet }: TransformContext) {
  // Your transformation logic
}
```

The transform file is dynamically imported at runtime. It accepts:
- A `default` export function
- A named `transform` export function
- The module itself as a function

## Adapter Resolution

The CLI auto-resolves adapters by file extension:

| Extension | Adapter |
|-----------|---------|
| `.ts`, `.tsx` | TypeScript adapter |
| `.js`, `.jsx` | TypeScript adapter (JSX mode) |
| `.mjs`, `.cjs` | TypeScript adapter (JS mode) |
| `.css`, `.scss` | CSS adapter |

## Output

The CLI displays results with ANSI colors:

```
✓ src/utils/helpers.ts (3 changes)
✓ src/services/api.ts (1 change)  
✗ src/components/Button.tsx (unchanged)

Summary: 2 changed, 1 unchanged, 0 errored
```

With `--verbose`, it shows diffs for changed files:

```diff
- import lodash from 'lodash'
+ import lodash from 'lodash-es'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NO_COLOR` | Disable ANSI colors (sets [NO_COLOR](https://no-color.org)) |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success (no errors) |
| 1 | Error occurred or `--transform` was missing |
