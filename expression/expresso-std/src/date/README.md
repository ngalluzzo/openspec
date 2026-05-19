# @std/date

Standard date operators for Expresso, compatible with JsonLogic specification.

## Installation

```bash
bun add @std/date
```

## Usage

```typescript
import { pluginRegistry } from '/expresso';
import datePlugin from '@std/date';

// Load the plugin
await pluginRegistry.load(datePlugin);

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
