# @std/logic

Standard logic operators for Expresso, compatible with JsonLogic specification.

## Installation

```bash
bun add @std/logic
```

## Usage

```typescript
import { pluginRegistry } from '/expresso';
import logicPlugin from '@std/logic';

// Load the plugin
await pluginRegistry.load(logicPlugin);

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
