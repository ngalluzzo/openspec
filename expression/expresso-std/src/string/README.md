# String plugin (`@gooi/expresso-std`)

Standard string operators for Expresso, compatible with JsonLogic specification.

## Operators

### String Manipulation

- `split` - Split string by delimiter
- `trim` - Remove whitespace from both ends
- `cat` - Concatenate strings
- `substr` - Extract substring

### Case Conversion

- `to_lower` - Convert to lowercase
- `to_upper` - Convert to uppercase

### Search & Validation

- `in` - Check if substring/container includes value
- `is_empty` - Check if empty
- `type` - Get type of value

## Installation

```bash
bun add @gooi/expresso-std
```

## Usage

```typescript
import { pluginRegistry } from "@gooi/expresso";
import { stringPlugin } from "@gooi/expresso-std";

// Load the plugin
await pluginRegistry.load(stringPlugin);

// Use operators
const result = apply({ to_lower: ['HELLO WORLD'] }, {});
```

## Examples

### Split

```typescript
{ 'split': ['hello,world', ','] }  // ['hello', 'world']
{ 'split': ['hello world', ' '] }  // ['hello', 'world']
```

### Trim

```typescript
{ 'trim': ['  hello  '] }  // 'hello'
```

### To Lower / To Upper

```typescript
{ 'to_lower': ['HELLO'] }  // 'hello'
{ 'to_upper': ['hello'] }  // 'HELLO'
```

### In

```typescript
{ 'in': ['world', 'hello world'] }  // true
{ 'in': [2, [1, 2, 3]] }            // true
{ 'in': ['x', 'hello world'] }      // false
```

### Concatenate

```typescript
{ 'cat': ['hello', ' ', 'world'] }  // 'hello world'
{ 'cat': [1, 2, 3] }                // '123'
```

### Substring

```typescript
{ 'substr': ['hello', 1] }       // 'ello'
{ 'substr': ['hello', 1, 2] }    // 'el'
{ 'substr': ['hello', -2] }      // 'lo'
```

### Is Empty

```typescript
{ 'is_empty': [''] }       // true
{ 'is_empty': ['hello'] }  // false
{ 'is_empty': [[]] }       // true
{ 'is_empty': [null] }     // false
```

### Type

```typescript
{ 'type': ['hello'] }      // 'string'
{ 'type': [42] }           // 'number'
{ 'type': [[1, 2, 3]] }    // 'array'
{ 'type': [null] }         // 'null'
```

## License

MIT
