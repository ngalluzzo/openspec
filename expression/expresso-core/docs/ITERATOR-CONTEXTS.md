# Iterator Contexts in EXPRESSO

EXPRESSO provides powerful iterator context handling that allows you to access
parent scopes and iteration metadata in filter, map, and other array operations.
This feature sets EXPRESSO apart from standard JSONLogic and enables complex
data transformations that would otherwise be impossible.

## Overview

When iterating over arrays (using `map`, `filter`, `all`, `none`, `some`, etc.),
EXPRESSO creates **scopes** that track:

1. **Parent context** - access data from outer scopes
2. **Iteration metadata** - information about the current iteration state

## Parent Context Access with `../`

The `var` operator supports accessing parent scope data using Handlebars-style
path notation. This allows you to reference data from outer scopes while
processing array elements.

### Syntax

- `'../fieldName'` - access parent scope field
- `'../../grandParentField'` - access grandparent scope
- `'../path.to.field'` - access nested field in parent scope

### Basic Examples

#### Access Parent Field in Map

```typescript
import { apply } from '/expresso';

const rule = {
  map: [
    [1, 2, 3],
    {
      '+': [
        { var: '' }, // Current element
        { var: '../multiplier' }, // Parent context
      ],
    },
  ],
};

const data = { multiplier: 10 };
const result = apply(rule, data);
// Result: [11, 12, 13]
```

#### Filter Using Parent Context

```typescript
const rule = {
  filter: [[1, 2, 3, 4, 5], { '>': [{ var: '' }, { var: '../threshold' }] }],
};

const data = { threshold: 3 };
const result = apply(rule, data);
// Result: [4, 5]
```

#### Nested Parent Access

```typescript
const rule = {
  map: [
    [
      { items: [1, 2], offset: 50 },
      { items: [3, 4], offset: 50 },
    ],
    {
      map: [
        { var: 'items' },
        {
          '+': [
            { var: '' }, // Current item (1, 2, 3, 4)
            { var: '../offset' }, // Parent's offset (50)
          ],
        },
      ],
    },
  ],
};

const result = apply(rule, {});
// Result: [[51, 52], [53, 54]]
```

### Real-World Use Cases

#### Department Processing

```typescript
const data = {
  bonus: 100,
  multiplier: 1.5,
};

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

const result = apply(rule, data);
// Result: [['Alice (Engineering)', 'Bob (Engineering)'], ['Charlie (Sales)']]
```

#### Conditional Processing with Parent Data

```typescript
const rule = {
  map: [
    [10, 20, 30],
    {
      if: [
        { var: '@first' },
        { '+': [{ var: '' }, { var: '../bonus' }] },
        { '*': [{ var: '' }, { var: '../multiplier' }] },
      ],
    },
  ],
};

const data = { bonus: 100, multiplier: 1.5 };
const result = apply(rule, data);
// Result: [110, 30, 45]
// First element gets bonus, others get multiplied
```

#### Complex Filtering with Parent Context

```typescript
const rule = {
  filter: [
    [5, 10, 15, 20, 25],
    {
      and: [
        { '>': [{ var: '' }, { var: '../minValue' }] },
        { '<': [{ var: '@index' }, { var: '../maxIndex' }] },
      ],
    },
  ],
};

const data = { minValue: 8, maxIndex: 4 };
const result = apply(rule, data);
// Result: [10, 15, 20]
// Values > 8 AND index < 4
```

### Edge Cases

#### Too Many `../` Returns Undefined

```typescript
const rule = {
  map: [[1, 2, 3], { var: '../../../value' }],
};

const data = { value: 10 };
const result = apply(rule, data);
// Result: [undefined, undefined, undefined]
// No scope exists 3 levels up
```

#### Empty Arrays Work Correctly

```typescript
const rule = {
  map: [[], { '+': [{ var: '' }, { var: '../offset' }] }],
};

const data = { offset: 10 };
const result = apply(rule, data);
// Result: []
```

## Iteration Metadata

EXPRESSO provides special variables that give you information about the current
iteration state.

### Available Metadata

- `@index` - Current iteration index (0-based)
- `@first` - `true` if first element, `false` otherwise
- `@last` - `true` if last element, `false` otherwise
- `@total` - Total number of items in the array

### Examples

#### Access @index

```typescript
const rule = {
  map: [['a', 'b', 'c'], { var: '@index' }],
};

const result = apply(rule, {});
// Result: [0, 1, 2]
```

#### Use @index in Calculations

```typescript
const rule = {
  map: [
    [10, 20, 30],
    {
      '+': [{ var: '' }, { var: '@index' }],
    },
  ],
};

const result = apply(rule, {});
// Result: [10, 21, 32]
```

#### Use @first Boolean

```typescript
const rule = {
  map: [[1, 2, 3], { var: '@first' }],
};

const result = apply(rule, {});
// Result: [true, false, false]
```

#### Use @last Boolean

```typescript
const rule = {
  map: [[1, 2, 3], { var: '@last' }],
};

const result = apply(rule, {});
// Result: [false, false, true]
```

#### Access @total Count

```typescript
const rule = {
  map: [[1, 2, 3, 4, 5], { var: '@total' }],
};

const result = apply(rule, {});
// Result: [5, 5, 5, 5, 5]
```

### Real-World Use Cases

#### Conditional Logic with @first and @last

```typescript
const rule = {
  map: [
    [1, 2, 3, 4, 5],
    {
      if: [
        { var: '@first' },
        'FIRST',
        {
          if: [{ var: '@last' }, 'LAST', 'MIDDLE'],
        },
      ],
    },
  ],
};

const result = apply(rule, {});
// Result: ['FIRST', 'MIDDLE', 'MIDDLE', 'MIDDLE', 'LAST']
```

#### Filter by Index

```typescript
const rule = {
  filter: [[10, 20, 30, 40, 50], { '<': [{ var: '@index' }, 3] }],
};

const result = apply(rule, {});
// Result: [10, 20, 30]
// Only elements with index < 3
```

#### Filter by Position

```typescript
const rule = {
  filter: [[10, 20, 30], { var: '@first' }],
};

const result = apply(rule, {});
// Result: [10]
```

```typescript
const rule = {
  filter: [[10, 20, 30], { var: '@last' }],
};

const result = apply(rule, {});
// Result: [30]
```

#### Index-Based Formatting

```typescript
const rule = {
  map: [
    ['apple', 'banana', 'cherry'],
    {
      cat: [{ var: '@index' }, '. ', { var: '' }],
    },
  ],
};

const result = apply(rule, {});
// Result: ['0. apple', '1. banana', '2. cherry']
```

## Combining Parent Context and Metadata

You can combine `../` parent context access with `@` metadata variables for
powerful transformations.

### Example: Conditional Bonus with Index Check

```typescript
const rule = {
  map: [
    [100, 200, 300, 400],
    {
      if: [
        {
          and: [
            { var: '@first' },
            { '>': [{ var: '' }, { var: '../minAmount' }] },
          ],
        },
        { '+': [{ var: '' }, { var: '../bonus' }] },
        { var: '' },
      ],
    },
  ],
};

const data = { minAmount: 50, bonus: 50 };
const result = apply(rule, data);
// Result: [150, 200, 300, 400]
// Only first element gets bonus if > minAmount
```

### Example: Filtering with Multiple Conditions

```typescript
const rule = {
  filter: [
    [5, 10, 15, 20, 25],
    {
      and: [
        { '>': [{ var: '' }, { var: '../minValue' }] },
        { '<': [{ var: '@index' }, { var: '../maxIndex' }] },
        { '!': [{ var: '@last' }] },
      ],
    },
  ],
};

const data = { minValue: 8, maxIndex: 4 };
const result = apply(rule, data);
// Result: [10, 15, 20]
// Value > 8, index < 4, not last element
```

### Example: Nested Access with All Features

```typescript
const rule = {
  map: [
    [
      { threshold: 10, values: [1, 5, 15, 20] },
      { threshold: 50, values: [10, 30, 60, 80] },
    ],
    {
      map: [
        { var: 'values' },
        {
          if: [
            {
              and: [
                { '>': [{ var: '' }, { var: '../threshold' }] },
                { var: '@first' },
              ],
            },
            { cat: [{ var: '' }, ' (first above threshold)'] },
            { var: '' },
          ],
        },
      ],
    },
  ],
};

const result = apply(rule, {});
// Result: [['1', '5', '15 (first above threshold)', '20'], ['10', '30', '60 (first above threshold)', '80']]
```

## Scope Management

### How Scopes Work

1. **Initial scope** - Created with root data
2. **Array iteration** - Creates new scope for each element with:
   - `data` = current element
   - `iteration` = iteration metadata (index, total, first, last)
3. **Nested iterations** - Each level adds to scope stack
4. **Scope resolution** - `var` checks scopes from most recent to oldest

### Scope Hierarchy

```typescript
// Scope stack for nested map:
// Index 2 (innermost): current element from inner array
// Index 1: element from outer array
// Index 0: root data

const rule = {
  map: [
    [{ items: [1, 2] }],
    {
      map: [
        { var: 'items' },
        { var: '../../items' }, // Access outer array's items
      ],
    },
  ],
};
```

## Operators That Support Iterator Contexts

All array iteration operators support parent context and iteration metadata:

- `map` - Transform each element
- `filter` - Filter by predicate
- `reduce` - Reduce to single value
- `all` - All match predicate
- `none` - None match predicate
- `some` - Some match predicate
- `find` - Find first match
- `find_index` - Find index of first match

## Backward Compatibility

All existing code continues to work:

```typescript
// Empty path for current element (still works)
{ 'map': [[1, 2, 3], { '*': [{ 'var': '' }, 2] }] }
// Result: [2, 4, 6]

// Dot notation for nested access (still works)
{ 'var': 'user.name' }
// Result: 'John' (with data: { user: { name: 'John' } })

// Default values (still work)
{ 'var': ['user.email', 'default@example.com'] }
// Result: 'default@example.com' (if user.email is undefined)

// Array indexing in var (still works)
{ 'var': 'items.0' }
// Result: 'first' (with data: { items: ['first', 'second'] })
```

## Best Practices

### 1. Use Parent Context for Configuration

```typescript
// Good: Configuration in parent scope
const rule = {
  map: [[10, 20, 30], { '*': [{ var: '' }, { var: '../multiplier' }] }],
};
const data = { multiplier: 2 };

// Avoid: Hardcoding values
const rule = {
  map: [
    [10, 20, 30],
    { '*': [{ var: '' }, 2] }, // Hardcoded
  ],
};
```

### 2. Use Metadata for Position-Based Logic

```typescript
// Good: Use @first/@last for position checks
const rule = {
  'map': [
    [1, 2, 3, 4, 5],
    {
      'if': [
        { 'var': '@first' },
        'START',
        { 'if': [{ 'var': '@last' }, 'END', { 'var': '' }]
      ]
    }
  ]
};
```

### 3. Combine Features for Complex Transformations

```typescript
// Good: Combine parent context, metadata, and conditions
const rule = {
  map: [
    [10, 20, 30],
    {
      if: [
        {
          and: [
            { var: '@first' },
            { '>': [{ var: '' }, { var: '../minValue' }] },
          ],
        },
        { '+': [{ var: '' }, { var: '../bonus' }] },
        { '*': [{ var: '' }, { var: '../multiplier' }] },
      ],
    },
  ],
};
```

### 4. Watch for Undefined Parent Context

```typescript
// Returns undefined if parent doesn't exist
{ 'var': '../../../nonexistent' }
// Handle with default values:
{
  'var': [
    '../../../nonexistent',
    { '@data': 'default' }
  ]
}
```

### 5. Use with @data for Defaults

```typescript
// Good: Combine parent context with @data defaults
const rule = {
  map: [
    [1, 2, 3],
    { '*': [{ var: '' }, { var: ['../multiplier', { '@data': 1 }] }] },
  ],
};
const data = {}; // No multiplier defined
const result = apply(rule, data);
// Result: [1, 2, 3] (uses default multiplier of 1)
```

## Performance Considerations

1. **Scope lookup** is O(n) where n is scope depth (usually small)
2. **Parent context access** is slightly slower than direct variable access
3. **Metadata access** (`@index`, etc.) is very fast (cached per iteration)
4. For most use cases, performance impact is negligible

## Comparison with Standard JSONLogic

| Feature                             | Standard JSONLogic | EXPRESSO                   |
| ----------------------------------- | ------------------ | -------------------------- |
| Parent context access (`../`)       | ❌ Not supported   | ✅ Supported               |
| Iteration metadata (`@index`, etc.) | ❌ Not supported   | ✅ Supported               |
| Current element access              | `{ '' }`           | `{ '' }`                   |
| Nested iteration access             | ❌ Not supported   | ✅ Supported with `../../` |

## Migration from Standard JSONLogic

If you're migrating rules from standard JSONLogic:

1. **No breaking changes** - All existing rules work as-is
2. **Add parent context** - Use `../` to access outer scopes
3. **Use metadata** - Add `@index`, `@first`, etc. for iteration-aware logic
4. **Test thoroughly** - Ensure behavior matches expectations

```typescript
// Before (standard JSONLogic)
{
  "map": [
    { "var": "items" },
    { "*": [{ "var": "" }, 2] }
  ]
}

// After (EXPRESSO with parent context)
{
  "map": [
    { "var": "items" },
    { "*": [{ "var": "" }, { "var": "../multiplier" }] }
  ]
}
```

## Common Patterns

### Pattern 1: Skip First Element

```typescript
{
  'filter': [
    [1, 2, 3, 4, 5],
    { '!': { 'var': '@first' } }
  ]
}
// Result: [2, 3, 4, 5]
```

### Pattern 2: Get First N Elements

```typescript
{
  'filter': [
    [1, 2, 3, 4, 5],
    { '<': [{ 'var': '@index' }, { 'var': '../count' }] }
  ]
}
// With data: { count: 3 }
// Result: [1, 2, 3]
```

### Pattern 3: Index-Based Formatting

```typescript
{
  'map': [
    ['a', 'b', 'c'],
    {
      'cat': [
        { 'var': '@index' },
        '. ',
        { 'var': '' }
      ]
    }
  ]
}
// Result: ['0. a', '1. b', '2. c']
```

### Pattern 4: Conditional First/Last Processing

```typescript
{
  'map': [
    [10, 20, 30],
    {
      'if': [
        { 'var': '@first' },
        { '+': [{ 'var': '' }, { 'var': '../bonus' }] },
        { 'if': [{ 'var': '@last' }, { '-': [{ 'var': '' }, { 'var': '../discount' }] }, { 'var': '' }]
      ]
    }
  ]
}
// First gets bonus, last gets discount, others unchanged
```

## Troubleshooting

### Problem: Getting `undefined` with `../`

**Cause:** Parent scope doesn't exist or field is missing

**Solution:** Check scope depth and use default values

```typescript
{ 'var': ['../field', { '@data': 'default' }] }
```

### Problem: `@index` not incrementing

**Cause:** Using in operator that doesn't create iteration scope

**Solution:** Only works with `map`, `filter`, `reduce`, `all`, `none`, `some`,
`find`, `find_index`

### Problem: Nested access doesn't work

**Cause:** Wrong number of `../` levels

**Solution:** Count scope levels (root = 0, first iteration = 1, second
iteration = 2)

```typescript
// Root → outer map (1 level) → inner map (2 levels)
// Need ../../ to access root
```

### Problem: Performance degradation

**Cause:** Excessive parent context lookups in large arrays

**Solution:** Cache parent values if accessed repeatedly

```typescript
// Instead of: { 'var': '../expensive.lookup' } in every iteration
// Consider: Apply once to parent, then use in iteration
```

## Advanced Topics

### Dynamic Path Construction

```typescript
{
  'map': [
    [{ path: 'user.name' }, { path: 'user.age' }],
    { 'var': { 'var': 'path' } }
  ]
}
// Uses dynamic path from element
```

### Combining Multiple Operators

```typescript
{
  'map': [
    { 'filter': [{ 'var': '../items' }, { '>': [{ 'var': '' }, { 'var': '../min' }] }] },
    { '+': [{ 'var': '' }, { 'var': '../../bonus' }] }
  ]
}
// Filter first, then map with parent context
```

### Error Handling

```typescript
{
  'map': [
    [1, 2, 3],
    {
      'try': [
        { 'var': '../nonexistent.field' },
        { '@data': 'fallback' }
      ]
    }
  ]
}
// Uses try operator to handle missing parent context
```

## Conclusion

Iterator contexts are a powerful feature that enables complex data
transformations in EXPRESSO rules. By combining parent context access (`../`)
and iteration metadata (`@index`, `@first`, `@last`, `@total`), you can express
logic that would be impossible or cumbersome in standard JSONLogic.

Key takeaways:

- Use `../` to access parent scopes in nested iterations
- Use `@index`, `@first`, `@last`, `@total` for position-aware logic
- Combine features for sophisticated transformations
- Maintain backward compatibility with existing rules
- Follow best practices for clarity and performance
