# @reforge/adapters

Language-specific parser adapters for the reforge engine.

## Quick Features

- TypeScript adapter — uses the official TypeScript compiler API with format-preserving print support
- CSS/SCSS adapter — PostCSS-based parsing and printing with offset conversion
- Semantic diff support — TypeScript adapter exports `extractDeclarations()` for precise change detection
- Lazy loading — PostCSS loaded on demand with helpful error if missing
- Peer dependency design — only pull in parsers you need

## Usage

```ts
import { tsAdapter, cssAdapter } from "@reforge/adapters"
import { parse } from "@reforge/core"

const tsResult = parse(source, { adapter: tsAdapter })
const cssResult = parse(cssSource, { adapter: cssAdapter })
```

See [@reforge/core](../core) for the `ParserAdapter` interface this package implements.
