# @std/data-access

Standard data-access operators for Expresso, compatible with JsonLogic
specification.

## Installation

```bash
bun add @std/data-access
```

## Usage

```typescript
import { pluginRegistry } from "@gooi/expresso-core"
import data-accessPlugin from "@std/data-access"

// Load the plugin
await pluginRegistry.load(data-accessPlugin)

// Use operators
const result = apply(
  {
    "operator-name": [
      /* args */
    ]
  },
  {}
)
```

## License

MIT
