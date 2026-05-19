# Truthiness Modes in EXPRESSO

When writing portable business logic rules, truthiness (how values are converted
to boolean) varies significantly across programming languages. EXPRESSO provides
configurable truthiness modes to handle these differences.

## Why Truthiness Matters

Different languages have different rules for what counts as "truthy" (true in
boolean context):

| Value       | JavaScript | Python    | JsonLogic | Ruby      |
| ----------- | ---------- | --------- | --------- | --------- |
| `true`      | ✅ Truthy  | ✅ Truthy | ✅ Truthy | ✅ Truthy |
| `false`     | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | ❌ Falsy  |
| `0`         | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | ✅ Truthy |
| `1`         | ✅ Truthy  | ✅ Truthy | ✅ Truthy | ✅ Truthy |
| `""`        | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | ✅ Truthy |
| `"hello"`   | ✅ Truthy  | ✅ Truthy | ✅ Truthy | ✅ Truthy |
| `null`      | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | ❌ Falsy  |
| `undefined` | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | N/A       |
| `[]`        | ✅ Truthy  | ❌ Falsy  | ✅ Truthy | ✅ Truthy |
| `{}`        | ✅ Truthy  | ❌ Falsy  | ✅ Truthy | ✅ Truthy |
| `NaN`       | ❌ Falsy   | ❌ Falsy  | ❌ Falsy  | ✅ Truthy |

## Available Modes

### `default` (JavaScript Semantics)

Uses JavaScript's native truthiness rules. This is the default mode and
maintains backward compatibility.

**Falsy values:** `false`, `0`, `""`, `null`, `undefined`, `NaN`

**Truthy values:** Everything else (including `[]` and `{}`)

```typescript
import { apply } from '/expresso';

apply({ '!': [0] }, {}, { truthinessMode: 'default' }); // true
apply({ '!': [[]] }, {}, { truthinessMode: 'default' }); // false
apply({ if: [[], 'yes', 'no'] }, {}, { truthinessMode: 'default' }); // 'yes'
```

**Use case:** When your rules will only run in JavaScript environments or when
you want standard JavaScript behavior.

### `jsonlogic` (JsonLogic Specification)

Follows the official JsonLogic specification for boolean operations.

**Falsy values:** `false`, `0`, `""`, `null`, `undefined`

**Truthy values:** Everything else (including `[]` and `{}`)

Similar to default mode but excludes `NaN` from explicit falsy values.

```typescript
import { apply } from '/expresso';

apply({ '!': [0] }, {}, { truthinessMode: 'jsonlogic' }); // true
apply({ '!': [NaN] }, {}, { truthinessMode: 'jsonlogic' }); // false
```

**Use case:** When you need strict JsonLogic specification compliance.

### `python` (Python Semantics)

Follows Python's truthiness rules for portability to Python-based systems.

**Falsy values:** `false`, `0`, `0.0`, `""`, `null`, `undefined`, `NaN`, `[]`,
`{}` (empty objects)

**Truthy values:** Everything else

```typescript
import { apply } from '/expresso';

apply({ '!': [0] }, {}, { truthinessMode: 'python' }); // true
apply({ '!': [[]] }, {}, { truthinessMode: 'python' }); // true
apply({ '!': [[1, 2]] }, {}, { truthinessMode: 'python' }); // false
apply({ '!': [{}] }, {}, { truthinessMode: 'python' }); // true
apply({ '!': [{ a: 1 }] }, {}, { truthinessMode: 'python' }); // false
apply({ if: [[], 'yes', 'no'] }, {}, { truthinessMode: 'python' }); // 'no'
```

**Use case:** When porting rules to Python or when you need Python-like empty
collection handling.

### `strict` (Boolean-Only Mode)

Only `true` is truthy, only `false` is falsy. All other values throw or are
treated as falsy.

**Falsy values:** `false` and everything except `true`

**Truthy values:** Only `true`

```typescript
import { apply } from '/expresso';

apply({ '!': [true] }, {}, { truthinessMode: 'strict' }); // false
apply({ '!': [1] }, {}, { truthinessMode: 'strict' }); // true
apply({ '!': ['hello'] }, {}, { truthinessMode: 'strict' }); // true
apply({ '!': [[]] }, {}, { truthinessMode: 'strict' }); // true
apply({ if: [1, 'yes', 'no'] }, {}, { truthinessMode: 'strict' }); // 'no'
apply({ if: [true, 'yes', 'no'] }, {}, { truthinessMode: 'strict' }); // 'yes'
```

**Use case:** When you want explicit boolean checking and avoid type coercion.

## Usage

### With `apply()`

```typescript
import { apply } from '/expresso';

const rule = { if: [{ var: 'items' }, 'has-items', 'no-items'] };
const data = { items: [] };

// Default mode: empty arrays are truthy
apply(rule, data); // 'has-items'

// Python mode: empty arrays are falsy
apply(rule, data, { truthinessMode: 'python' }); // 'no-items'
```

### With `applyAsync()`

```typescript
import { applyAsync } from '/expresso';

const result = await applyAsync(rule, data, { truthinessMode: 'python' });
```

### With `compile()`

```typescript
import { compile } from '/expresso';

const fn = compile(rule, { truthinessMode: 'python' });
fn(data); // 'no-items'
```

## Common Portability Scenarios

### Scenario 1: Array Empty Checks

**Problem:** `{ "!": { "var": "data" } }` where `data` is `[]`

```javascript
// JavaScript/default: ![] → false
apply({ '!': { var: 'data' } }, { data: [] }); // false

// Python: ![] → true
apply({ '!': { var: 'data' } }, { data: [] }, { truthinessMode: 'python' }); // true
```

**Solution:** Use Python mode for Python targets.

### Scenario 2: Numeric Zero Checks

**Problem:** Zero behaves differently in Ruby vs others

```javascript
// JavaScript/default: !0 → true
apply({ '!': { var: 'value' } }, { value: 0 }); // true

// Ruby: !0 → false (zero is truthy in Ruby)
// No Ruby mode exists, use strict mode for explicit boolean handling
```

**Solution:** Use strict mode when you need explicit boolean values and want to
avoid numeric coercion.

### Scenario 3: Empty String vs Empty Collection

**Problem:** Distinguishing `""` from `[]` in boolean context

```javascript
// Both are falsy in most languages
apply({ if: ['', 'is-empty', 'not-empty'] }); // 'is-empty'
apply({ if: [[], 'is-empty', 'not-empty'] }); // 'is-empty' (default mode)
```

**Solution:** Use Python mode to treat empty collections as falsy while keeping
non-empty strings truthy:

```javascript
apply({ if: [[], 'is-empty', 'not-empty'] }, {}, { truthinessMode: 'python' }); // 'is-empty'
apply(
  { if: [['a'], 'is-empty', 'not-empty'] },
  {},
  { truthinessMode: 'python' }
); // 'not-empty'
```

## Operators Affected by Truthiness Mode

The following operators use truthiness evaluation:

- `!` - Logical NOT
- `!!` - Boolean conversion
- `or` - Logical OR
- `and` - Logical AND
- `if` - Conditional
- `switch` - Switch/case
- `some` - Array predicate (some elements match)
- `all` - Array predicate (all elements match)
- `none` - Array predicate (no elements match)
- `filter` - Array filtering
- `find` - Find first matching element
- `find_index` - Find index of first matching element

## Best Practices

1. **Choose the right mode for your target language**
   - Python → `python` mode
   - JavaScript/Node.js → `default` mode
   - Multiple language support → Document the mode and be consistent

2. **Be explicit with `!!` for boolean conversion**

   ```typescript
   const rule = { '==': [{ '!!': { var: 'value' } }, true] };
   ```

3. **Test with your target language** Always verify rule behavior in your target
   language(s), especially edge cases.

4. **Document your mode choice** Include the truthiness mode in your rule
   documentation or comments.

5. **Use strict mode for explicit boolean checks** When you want to avoid type
   coercion and only accept actual boolean values.

## Migration Guide

If you're migrating existing rules to use truthiness modes:

1. **Test with default mode first**

   ```typescript
   const result = apply(rule, data, { truthinessMode: 'default' });
   ```

2. **Identify edge cases** Look for array empty checks, zero values, and empty
   objects in your rules.

3. **Update to appropriate mode**

   ```typescript
   // If targeting Python
   apply(rule, data, { truthinessMode: 'python' });
   ```

4. **Verify against target language** Test your rules in the target language to
   ensure consistent behavior.

## Future Extensibility

The truthiness mode system is designed to be extensible. New modes can be added
to support additional language semantics (e.g., `ruby`, `php`, etc.) without
breaking existing functionality.

For more information or to request additional modes, please open an issue on
GitHub.
