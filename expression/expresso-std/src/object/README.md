# @std/object

Standard object operators for Expresso, compatible with JsonLogic specification.

## Installation

```bash
bun add @std/object
```

## Usage

```typescript
import { pluginRegistry } from '/expresso';
import objectPlugin from '@std/object';

// Load the plugin
await pluginRegistry.load(objectPlugin);

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
