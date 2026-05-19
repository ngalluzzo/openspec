# @std/misc

Standard misc operators for Expresso, compatible with JsonLogic specification.

## Installation

```bash
bun add @std/misc
```

## Usage

```typescript
import { pluginRegistry } from '/expresso';
import miscPlugin from '@std/misc';

// Load the plugin
await pluginRegistry.load(miscPlugin);

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
