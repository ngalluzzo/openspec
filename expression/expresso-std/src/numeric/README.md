# Numeric plugin (`@gooi/expresso-std`)

Standard numeric operators for Expresso, compatible with JsonLogic
specification.

## Operators

### Comparison

- `greater-than` - Greater than (>)
- `greater-equal` - Greater than or equal (>=)
- `less-than` - Less than (<)
- `less-equal` - Less than or equal (<=)
- `between` - Check if value is between min and max

### Aggregation

- `min` - Minimum value from array
- `max` - Maximum value from array

### Arithmetic

- `plus` - Addition (+)
- `minus` - Subtraction (-)
- `multiply` - Multiplication (\*)
- `divide` - Division (/)
- `modulo` - Modulo (%)

## Installation

```bash
bun add @gooi/expresso-std
```

## Usage

```typescript
import { pluginRegistry } from "@gooi/expresso";
import { numericPlugin } from "@gooi/expresso-std";

// Load the plugin
await pluginRegistry.load(numericPlugin);

// Use operators
const result = apply({ 'greater-than': [5, 3] }, {});
```

## Examples

### Greater Than

```typescript
{ 'greater-than': [5, 3] }  // true
{ 'greater-than': [3, 5] }  // false
```

### Between

```typescript
{ 'between': [5, 0, 10] }   // true
{ 'between': [15, 0, 10] }  // false
```

### Addition

```typescript
{ 'plus': [5, 3, 2] }  // 10
{ 'plus': [5, -3] }    // 2
```

## License

MIT
