# @std/comparison

Standard comparison operators for Expresso, compatible with JsonLogic
specification.

## Installation

```bash
bun add @std/comparison
```

## Usage

```typescript
import { pluginRegistry } from '/expresso';
import comparisonPlugin from '@std/comparison';

// Load the plugin
await pluginRegistry.load(comparisonPlugin);

// Use operators
const result = apply(
  {
    'operator-name': [
      /* args */
    ],
  },
  {}
);
```

## License

MIT
