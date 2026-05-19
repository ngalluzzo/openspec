# Expresso

A type-safe, Zod-powered JsonLogic implementation for TypeScript and Bun.

## Features

- **Type-safe rule building** with fluent API and Zod schema inference
- **Smart hybrid evaluation** - lazy by default, eager when needed
- **Plugin-friendly architecture** - all operators (including built-ins) are
  plugins
- **Full JsonLogic spec support** - all operator categories implemented
- **Frontend/backend agnostic** - pure TypeScript, works in any runtime
- **Comprehensive APIs** - sync, async, and compilation support
- **Debug mode** with evaluation tracing
- **Rule optimization** - automatically simplifies constant expressions
- **Configurable truthiness modes** - portable logic across JavaScript, Python,
  and more
- **Iterator context support** - access parent scopes (`../`) and iteration
  metadata (`@index`, `@first`, `@last`, `@total`)

## Iterator Contexts

EXPRESSO provides powerful iterator context handling that sets it apart from
standard JSONLogic. When iterating over arrays, you can access parent scopes and
iteration metadata.

### Parent Context Access with `../`

Access data from outer scopes using Handlebars-style path notation:

```typescript
import { apply } from '/expresso';

// Access parent field in map
const rule = {
  map: [[1, 2, 3], { '+': [{ var: '' }, { var: '../multiplier' }] }],
};

const data = { multiplier: 10 };
const result = apply(rule, data);
// Result: [11, 12, 13]
```

### Iteration Metadata

Access iteration state with special variables:

```typescript
// Access @index, @first, @last, @total
const rule = {
  map: [['a', 'b', 'c'], { var: '@index' }],
};

const result = apply(rule, {});
// Result: [0, 1, 2]
```

**Available metadata:**

- `@index` - current iteration index (0-based)
- `@first` - true if first element
- `@last` - true if last element
- `@total` - total count of items

### Real-World Example

```typescript
const rule = {
  map: [
    [
      { department: 'Engineering', employees: ['Alice', 'Bob'] },
      { department: 'Sales', employees: ['Charlie'] },
    ],
    {
      map: [
        { var: 'employees' },
        {
          cat: [{ var: '' }, { cat: [' (', { var: '../department' }, ')'] }],
        },
      ],
    },
  ],
};

const result = apply(rule, {});
// Result: [['Alice (Engineering)', 'Bob (Engineering)'], ['Charlie (Sales)']]
```

See [Iterator Contexts Guide](./docs/ITERATOR-CONTEXTS.md) for comprehensive
documentation.

## @data Marker

The `@data` marker allows you to embed literal data directly in rules without
evaluation. This is useful when you need to pass arrays, objects, or other
values as-is, preventing them from being interpreted as rules.

### How It Works

The `@data` marker wraps data and ensures it's passed through without
evaluation:

```typescript
// Without @data - array is evaluated (each element is treated as a rule)
const rule1 = { var: [1, { var: 'x' }, 3] };
// If x = 10, this evaluates to [1, 10, 3]

// With @data - array is passed as literal data
const rule2 = { var: { '@data': [1, { var: 'x' }, 3] } };
// Always evaluates to [1, { 'var': 'x' }, 3] - preserved as-is
```

### When To Use @data

Use `@data` when you need to:

- **Pass literal arrays** to operators like `map`, `filter`, `in`, etc.
- **Embed configuration objects** in rules
- **Prevent evaluation** of specific values
- **Maintain data structure integrity** when mixing data and rules

### Examples

#### Embedding Literal Arrays

```typescript
import { apply } from '/expresso';

// Map over a literal array
const rule = {
  map: [{ '@data': [1, 2, 3] }, { '*': [{ var: '' }, 2] }],
};
const result = apply(rule, {});
// Result: [2, 4, 6]
```

#### Using with Object Operators

```typescript
// Deep merge with embedded data
const rule = {
  merge_deep: [
    { var: 'userProfile' },
    { '@data': { createdAt: '2024-01-01', active: true } },
  ],
};
const result = apply(rule, { userProfile: { name: 'John' } });
// Result: { name: 'John', createdAt: '2024-01-01', active: true }
```

#### Conditional Logic with Embedded Data

```typescript
// Check if value exists in a literal set
const rule = {
  if: [
    { in: ['admin', { '@data': ['admin', 'user', 'guest'] }] },
    { '@data': 'Access granted' },
    { '@data': 'Access denied' },
  ],
};
const result = apply(rule, {});
// If user is 'admin': 'Access granted'
// If user is 'guest': 'Access denied'
```

#### Var Operator Default Values

```typescript
// Use @data for default values
const rule = { var: ['items', { '@data': [1, 2, 3] }] };
const result = apply(rule, {});
// If items is undefined: [1, 2, 3]
```

#### Comparison: With vs Without @data

```typescript
// Without @data - normal var evaluation
const normalRule = { var: 'x' };
const normalResult = apply(normalRule, { x: 'value' });
// Result: 'value' (looked up from data)

// With @data - literal value returned
const dataMarkerRule = { var: { '@data': 'x' } };
const dataMarkerResult = apply(dataMarkerRule, { x: 'different' });
// Result: 'x' (literal string, not a lookup)
```

### Validation

The `@data` marker validates its content and throws errors for invalid usage:

```typescript
// Error: Wrong key name
{ 'var': { 'data': 'value' } }  // Should be '@data'

// Error: Multiple keys
{ 'var': { '@data': 'value', 'other': 'key' } }

// Error: Single-key object that looks like a Rule
{ 'var': { '@data': { 'var': 'path' } } }
// Throws: Invalid @data marker: content appears to be a Rule

// Valid: Multi-key objects
{ 'var': { '@data': { 'path': 'x', 'type': 'field' } } }
```

### Advanced Use Cases

#### Configuration as Data

```typescript
// Embed configuration in rule
const config = {
  defaultTimeout: 5000,
  maxRetries: 3,
  backoffMultiplier: 2,
};

const rule = {
  map: [
    { '@data': ['api1', 'api2', 'api3'] },
    {
      merge: [{ '@data': config }, { var: '' }],
    },
  ],
};
```

#### Test Data in Rules

```typescript
// Define test cases directly in rule
const rule = {
  map: [
    {
      '@data': [
        { input: 5, expected: 10 },
        { input: 10, expected: 20 },
        { input: 15, expected: 30 },
      ],
    },
    {
      '==': [{ '*': [{ var: 'input' }, 2] }, { var: 'expected' }],
    },
  ],
};
const results = apply(rule, {});
// Result: [true, true, true]
```

### Compile Support

The `@data` marker works with compiled rules and debug tracing:

```typescript
import { compile, compileDebug } from '/expresso';

const rule = { map: [{ '@data': [1, 2, 3] }, { '*': [{ var: '' }, 2] }] };

// Compile for performance
const compiled = compile(rule);
const result = compiled({}); // [2, 4, 6]

// Debug tracing with @data
const { result, trace } = compileDebug(rule)({});
// Trace includes '@data' operator with full array: [[1, 2, 3]]
```

### Best Practices

1. **Use @data for constant values** - Prefer over repeating data in multiple
   places
2. **Structure embedded data clearly** - Multi-key objects are clearer than
   deeply nested single-key rules
3. **Validate before embedding** - Ensure data structure is correct to avoid
   runtime errors
4. **Consider compile-time data** - For truly static data, consider hardcoding
   it in the rule evaluation code
5. **Keep data readable** - Multi-key objects with descriptive keys are easier
   to maintain than complex rule structures

### Performance Notes

- **Static arrays** (all primitives) are automatically optimized without needing
  `@data`
- Use `@data` for arrays/objects with mixed types or when you need explicit
  control
- `@data` markers are preserved in JSON serialization, allowing round-trip
  safety

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { apply, rule } from '/expresso';

// Using JSON rules
const data = { user: { age: 25, roles: ['admin'] } };
const rule = {
  and: [
    { '>': [{ var: 'user.age' }, 18] },
    { in: ['admin', { var: 'user.roles' }] },
  ],
};
const result = apply(rule, data); // true

// Using the builder API
const built = rule()
  .var('user.age')
  .gt(18)
  .and(rule().var('user.roles').in('admin'))
  .build();
const result = apply(built, data); // true
```

## API

### Core Functions

```typescript
// Synchronous evaluation
apply(rule, data, options?): unknown

// Asynchronous evaluation
applyAsync(rule, data, options?): Promise<unknown>

// Compile for repeated use
compile(rule, options?): CompiledRule
const fn = compile(rule);
fn(data1);
fn(data2);
```

### Rule Builder

```typescript
rule().var('path.to.field').gt(18).and(rule().var('other').eq('value')).build();
```

Available builder methods:

- `var(path)` - Access data field
- `missing(...fields)` - Check for missing fields
- `missing_some(count, ...fields)` - Partial missing check
- `if(condition, then, else)` - Conditional
- `eq(value)`, `strictEq(value)`, `neq(value)`, `strictNeq(value)` - Equality
- `not()`, `isTrue()` - Negation
- `and(...rules)`, `or(...rules)` - Logical operations
- `gt(value)`, `gte(value)`, `lt(value)`, `lte(value)` - Comparison
- `between(min, max)` - Range check
- `min(...values)`, `max(...values)` - Min/max
- `add(...values)`, `subtract(value)`, `multiply(value)`, `divide(value)`,
  `modulo(value)` - Arithmetic
- `in(value)` - Contains (array or string)
- `map(rule)`, `filter(rule)`, `reduce(rule, initial)` - Array operations
- `all()`, `none()`, `some()` - Array predicates
- `merge(...values)` - Combine arrays
- `cat(...values)` - Concatenate strings
- `substr(start, length)` - Substring

### Custom Operators

```typescript
import { registerSync } from '/expresso';
import { z } from 'zod';

registerSync(
  'customOp',
  ([a, b], data, ctx) => {
    return a + b;
  },
  {
    inputSchema: z.tuple([z.number(), z.number()]),
    outputSchema: z.number(),
  }
);

// Async operators
import { registerAsync } from '/expresso';

registerAsync(
  'asyncOp',
  async ([id], data, ctx) => {
    return await fetchUser(id);
  },
  {
    inputSchema: z.tuple([z.string()]),
    outputSchema: z.object({ id: z.string(), name: z.string() }),
    eager: true, // Prevent premature argument evaluation
  }
);
```

### Evaluation Options

```typescript
apply(rule, data, {
  lazy: true, // Use lazy evaluation (default: true)
  debug: false, // Enable debug tracing (default: false)
  maxDepth: 100, // Maximum recursion depth (default: 100)
  validateArgs: false, // Validate arguments with Zod schemas (default: false)
  truthinessMode: 'default', // Truthiness mode: 'default' | 'jsonlogic' | 'python' | 'strict'
});
```

See [Truthiness Modes](./docs/TRUTHINESS.md) for details on portable boolean
evaluation across languages.

### Debug Mode

Debug mode provides detailed evaluation traces for debugging complex rules.

```typescript
import { applyDebug, applyAsyncDebug, compileDebug } from '/expresso';

// Debug evaluation with trace
const result = applyDebug(rule, data);
console.log('Result:', result.result);
console.log('Trace:', result.trace);
// Trace is an array of EvaluationTrace entries:
// {
//   depth: number,      // Nesting depth of operator
//   operator: string,   // Operator name
//   args: unknown[],    // Evaluated arguments
//   result: unknown,    // Operator result
//   timestamp: number   // Millisecond timestamp
// }

// Async debug evaluation
const asyncResult = await applyAsyncDebug(rule, data);
console.log('Result:', asyncResult.result);
console.log('Trace:', asyncResult.trace);

// Compiled debug evaluation
const compiledFn = compileDebug(rule);
const compiledResult = compiledFn(data);
console.log('Result:', compiledResult.result);
console.log('Trace:', compiledResult.trace);
```

Example trace output:

```typescript
{
  result: true,
  trace: [
    {
      depth: 1,
      operator: 'var',
      args: ['user.age'],
      result: 25,
      timestamp: 1768597639204
    },
    {
      depth: 0,
      operator: '>',
      args: [25, 18],
      result: true,
      timestamp: 1768597639205
    }
  ]
}
```

### Trace Utilities

Utility functions for formatting and analyzing traces:

```typescript
import { formatTrace, formatTraceSummary, getTraceByOperator } from '/expresso';

// Format trace for display
console.log(formatTrace(trace));
// 1. [depth 1] var → 25 args: ["user.age"]
// 2. [depth 0] > → true args: [25,18]

// Format with options
console.log(
  formatTrace(trace, {
    showTimestamps: true,
    showArgs: false,
    indentSpaces: 4,
  })
);

// Get summary statistics
console.log(formatTraceSummary(trace));
// Total evaluations: 11
// Max depth: 2
// Operators used: 6
// Evaluations by operator:
//   - var: 5
//   - >: 2
//   - ==: 1
//   ...

// Filter traces by operator
const varTraces = getTraceByOperator(trace, 'var');
const depth1Traces = getTraceByDepth(trace, 1);
```

## Supported Operators

### Data Access

- `var` - Access nested data by path
- `missing` - Check if any fields are missing
- `missing_some` - Check if at least N fields are missing

### String Operators

- `split` - Split string by delimiter
- `trim` - Remove whitespace from both ends
- `trim_start` - Remove leading whitespace
- `trim_end` - Remove trailing whitespace
- `to_lower` - Convert to lowercase
- `to_upper` - Convert to uppercase
- `replace` - Replace with regex pattern
- `pad_left` - Pad left with character
- `pad_right` - Pad right with character
- `capitalize` - Capitalize first letter
- `reverse` - Reverse string
- `length` - Get string length
- `slice` - Extract substring
- `includes` - Check if substring exists
- `starts_with` - Check if starts with substring
- `ends_with` - Check if ends with substring
- `repeat` - Repeat string
- `index_of` - Find first index of substring
- `last_index_of` - Find last index of substring
- `cat` - Concatenate strings
- `substr` - Extract substring
- `in` - Check if substring exists (alias for includes)

### Date/Time Operators

- `now` - Current timestamp
- `today` - Today's date
- `date_parse` - Parse date string to ISO
- `date_to_timestamp` - Convert date string to timestamp
- `timestamp_to_date` - Convert timestamp to ISO date
- `date_after` - Check if date is after another
- `date_before` - Check if date is before another
- `date_between` - Check if date is in range
- `date_add` - Add time to date
- `date_diff` - Calculate difference between dates
- `extract_date_part` - Extract year/month/day/etc
- `is_weekday` - Check if weekday
- `is_weekend` - Check if weekend
- `date_format` - Format date string

### Logic & Boolean

- `if` - Conditional
- `==`, `===`, `!=`, `!==` - Equality
- `!`, `!!` - Negation
- `or` - Logical OR (short-circuit)
- `and` - Logical AND (short-circuit)
- `switch` - Switch/case pattern
- `ternary` - Ternary operator
- `coalesce` - First non-null value
- `default` - Default if null/undefined
- `try` - Try with fallback

### Numeric

- `>`, `>=`, `<`, `<=` - Comparison
- `between` - Inclusive range check
- `min`, `max` - Minimum/maximum
- `+`, `-`, `*`, `/`, `%` - Arithmetic
- `abs` - Absolute value
- `ceil` - Round up
- `floor` - Round down
- `round` - Round to precision
- `truncate` - Remove decimals
- `sum` - Sum array values
- `average` - Mean of array
- `clamp` - Constrain to range
- `random` - Random number
- `pow` - Power
- `sqrt` - Square root
- `natural_log` - Natural logarithm
- `log10` - Base-10 logarithm
- `exp` - Exponential
- `sin`, `cos`, `tan` - Trigonometry
- `to_radians` - Convert degrees to radians
- `to_degrees` - Convert radians to degrees
- `min_by` - Minimum by property
- `max_by` - Maximum by property
- `median` - Median value
- `mode` - Most frequent value

### Array

All array operators support **iterator contexts** - access parent scopes with
`../` and iteration metadata with `@index`, `@first`, `@last`, `@total`. See
[Iterator Contexts Guide](./docs/ITERATOR-CONTEXTS.md).

- `map` - Transform each element
- `filter` - Filter by predicate
- `reduce` - Reduce to single value
- `all` - All match predicate
- `none` - None match predicate
- `some` - Some match predicate
- `merge` - Concatenate arrays
- `in` - Array contains
- `flatten` - Flatten nested arrays
- `unique` - Remove duplicates
- `chunk` - Split into batches
- `array_slice` - Get subarray
- `sort` - Sort array
- `sort_by` - Sort by property
- `find` - Find first match
- `find_index` - Find index of match
- `take` - First n elements
- `drop` - All except first n
- `zip` - Combine arrays
- `unzip` - Split paired arrays
- `shuffle` - Randomize order
- `group_by` - Group by property
- `intersection` - Common elements
- `difference` - Elements in A not in B
- `union` - Combine arrays

### Object

- `keys` - Get object keys
- `values` - Get object values
- `entries` - Get key-value pairs
- `pick` - Select specific keys
- `omit` - Remove specific keys
- `merge_deep` - Deep merge objects
- `get` - Deep get with default
- `set` - Deep set (create path)
- `unset` - Deep delete (remove path)
- `has` - Check if path exists
- `transform` - Transform keys/values

### String

- `in` - Substring contains
- `cat` - Concatenate strings
- `substr` - Extract substring

### Validation

- `matches` - Regex match
- `is_empty` - Check if empty
- `is_null` - Check if null/undefined
- `is_undefined` - Check if undefined
- `is_nan` - Check if NaN
- `is_finite` - Check if finite
- `is_integer` - Check if integer
- `is_float` - Check if float
- `is_string` - Check if string
- `is_number` - Check if number
- `is_boolean` - Check if boolean
- `is_array` - Check if array
- `is_object` - Check if object
- `type` - Get type name
- `is_email` - Validate email
- `is_url` - Validate URL
- `is_uuid` - Validate UUID

### Type Conversion

- `to_string` - Convert to string
- `to_number` - Convert to number
- `to_boolean` - Convert to boolean
- `to_array` - Convert to array
- `to_object` - Convert to object

### Misc

- `log` - Console log values

## Examples

### Complex Business Logic

```typescript
import { rule, apply } from '/expresso';

// Discount eligibility rule
const discountRule = rule()
  .var('customer')
  .and(
    rule()
      .var('totalPurchases')
      .gte(1000)
      .and(rule().var('membership').eq('gold'))
  )
  .build();

// Use in both frontend and backend
const isEligible = apply(discountRule, customerData);
```

### Form Validation

```typescript
const validationRule = {
  and: [
    { var: 'email' },
    { '!==': [{ var: 'password' }, { var: 'confirmPassword' }] },
    { '>': [{ var: 'age' }, 18] },
  ],
};

const isValid = apply(validationRule, formData);
```

### Async Operations

```typescript
const asyncRule = {
  map: [{ var: 'userIds' }, { var: 'id' }],
};

const users = await applyAsync(asyncRule, { userIds: [1, 2, 3] });
// Uses async map operator to fetch users from API
```

### Debugging Complex Rules

```typescript
import { applyDebug, formatTrace, formatTraceSummary } from '/expresso';

const complexRule = {
  and: [
    { '>': [{ var: 'customer.totalPurchases' }, 1000] },
    { '==': [{ var: 'customer.membership' }, 'gold'] },
    { in: ['vip_bonus', { var: 'currentPromotions' }] },
  ],
};

const { result, trace } = applyDebug(complexRule, customerData);

console.log('Result:', result);
console.log('\nTrace:');
console.log(formatTrace(trace));
console.log('\nSummary:');
console.log(formatTraceSummary(trace));
```

Output:

```
Result: true

Trace:
    1. [depth 2] var → 1500 args: ["customer.totalPurchases"]
  2. [depth 1] > → true args: [1500,1000]
    3. [depth 2] var → "gold" args: ["customer.membership"]
  4. [depth 1] == → true args: ["gold","gold"]
  5. [depth 2] var → ["spring_sale","vip_bonus"] args: ["currentPromotions"]
  6. [depth 1] in → true args: ["vip_bonus",["spring_sale","vip_bonus"]]
7. [depth 0] and → true args: [true,true,true]

Summary:
Total evaluations: 7
Max depth: 2
Operators used: 4
Evaluations by operator:
  - var: 3
  - >: 1
  - ==: 1
  - in: 1
  - and: 1
```

## Documentation

- [Iterator Contexts](./docs/ITERATOR-CONTEXTS.md) - Parent context access
  (`../`) and iteration metadata (`@index`, `@first`, `@last`, `@total`)
- [Truthiness Modes](./docs/TRUTHINESS.md) - Portable boolean evaluation across
  JavaScript, Python, and more
- [Data Embedding](./docs/DATA-EMBEDDING.md) - Static array optimization and
  `@data` marker usage

## License

MIT
