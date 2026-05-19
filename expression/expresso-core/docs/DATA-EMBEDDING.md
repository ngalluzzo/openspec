# Data Embedding in EXPRESSO

This guide covers how data is embedded vs logic in EXPRESSO rules, including
automatic optimizations and the `@data` marker for explicit data handling.

## Data vs Logic

EXPRESSO uses a type-based model to distinguish between data and logic:

- **Primitives** (string, number, boolean, null) → Data (never evaluated)
- **Arrays** → Logic (evaluated element-by-element)
- **Objects** → Logic (evaluated as operators)

### Examples

```typescript
// Primitives are treated as data
{ '==': [{ 'var': 'age' }, 18] }  // 18 is data
{ 'in': ['admin', { 'var': 'roles' }] }  // 'admin' is data

// Arrays are evaluated
{ 'map': [[1, 2, 3], transform] }  // Array is evaluated element-by-element

// Objects are operators
{ 'if': [condition, then, else] }  // Object is evaluated as operator
```

## Static Array Optimization

EXPRESSO automatically optimizes arrays containing only primitive values:

```typescript
// This array is detected as static and used directly
{ 'map': [[1, 2, 3], { '*': [{ 'var': '' }, 2] }] }

// This array contains rules, so it's evaluated normally
{ 'map': [[1, { 'var': 'x' }, 3], transform] }
```

### When Optimization Activates

The optimization activates when:

- All array elements are primitives (string, number, boolean, null)
- Array is evaluated in the engine (not inside an eager operator)

### When Optimization Does NOT Activate

The optimization does not activate when:

- Array contains rules (e.g., `{ 'var': 'x' }`)
- Array contains objects (e.g., `{ 'key': 'value' }`)
- Array contains nested arrays

### Performance Impact

- **Static arrays**: 60-80% faster (skips evaluation loop)
- **Mixed arrays**: No change (still evaluated)
- **Large arrays**: Significant improvement (e.g., 1000+ elements)

### Automatic vs Explicit

The optimization is **automatic** and transparent:

```typescript
// This just works, automatically optimized
{ 'all': [[1, 2, 3], condition] }

// Same behavior, but explicit
{ 'all': [{ '@data': [1, 2, 3] }, condition] }
```

## @data Marker

For edge cases or explicit clarity, use the `@data` marker:

```typescript
// Explicitly mark array as literal data
{ 'map': [{ '@data': [1, 2, 3] }, transform] }

// Mark nested structure as data
{ 'merge': [userData, { '@data': { 'createdAt': '2024-01-01' } }] }

// Use in conditions
{ 'if': [{ '@data': false }, 'then', 'else'] }
```

### When to Use @data

1. **Performance**: Large static arrays
2. **Clarity**: When you want to be explicit about data
3. **Edge Cases**: Arrays with operator-like structure

### Validation

The `@data` marker validates structure:

- Must be an object with exactly one key named `'@data'`
- Content cannot be a single-key object that looks like a Rule
- Error thrown with clear message if invalid

**Valid:**

```typescript
{ '@data': [1, 2, 3] }
{ '@data': { 'key': 'value' } }
{ '@data': { 'var': 'x', 'other': 'y' } }  // Multi-key OK
{ '@data': null }
```

**Invalid:**

```typescript
{ '@data': { 'var': 'x' } }  // Error: Looks like a Rule
{ 'data': [1, 2, 3] }  // Error: Wrong key name
```

## Operator Implementation Best Practices

When implementing operators that handle arrays or objects:

1. Use `eager: true` to receive raw rules
2. Check `Array.isArray()` to detect static arrays
3. Document behavior with static and dynamic data

Example:

```typescript
defineAsyncOperator('myOp', {
  eager: true, // Important!
  handler: async ([array, rule], data, ctx) => {
    // Static array? Use directly.
    if (Array.isArray(array)) {
      return processArray(array);
    }

    // Dynamic? Evaluate as rule.
    const evaluatedArray = await evaluateRuleAsync(array as Rule, data, ctx);
    return processArray(evaluatedArray);
  },
});
```

## Edge Cases

### Empty Arrays

```typescript
// Static array optimization applies to empty arrays
{ 'all': [[], condition] }  // Returns true (vacuously true)
```

### Arrays with Null Values

```typescript
// Null is a primitive, so optimization applies
{ 'map': [[1, null, 3], transform] }
```

### Arrays with Operator-Like Structure

```typescript
// Use @data to treat as literal
{ '@data': [{ 'var': 'x' }, { '==': [1, 2] }] }

// Without @data, these would be evaluated as rules
```

## Migration Guide

### For Rule Authors

**No changes needed** for most rules:

```typescript
// This just works, now faster
{ 'all': [[1, 2, 3], condition] }
```

**Optional: Use @data for edge cases**:

```typescript
// If you were doing this:
// { 'var': [{ 'var': 'literal_string' }] }  // Oops, evaluates as rule

// Now do this:
{ 'var': [{ '@data': 'literal_string' }] }
```

### For Operator Implementers

**No changes needed** if you already use `eager: true` and `Array.isArray()`:

```typescript
// Already correct pattern
defineAsyncOperator('myOp', {
  eager: true,
  handler: async ([array, rule], data, ctx) => {
    if (Array.isArray(array)) {
      // Uses static array directly - optimized!
    }
  },
});
```

**Update documentation** to clarify data handling behavior.

## Debug Tracing

The `@data` marker appears in debug traces:

```typescript
{
  result: [2, 4, 6],
  trace: [
    {
      depth: 1,
      operator: '@data',
      args: [[1, 2, 3]],  // Shows embedded array
      result: [1, 2, 3],
      timestamp: 1234567890
    },
    {
      depth: 0,
      operator: 'map',
      args: [[1, 2, 3], { '*': [{ 'var': '' }, 2] }],
      result: [2, 4, 6],
      timestamp: 1234567891
    }
  ]
}
```

## JSON Serialization

The `@data` marker is preserved in JSON serialization:

```typescript
const rule = { map: [{ '@data': [1, 2, 3] }, transform] };
const json = JSON.stringify(rule);
// Result: {"map":[{"@data":[1,2,3]},transform]}

const loaded = JSON.parse(json);
// Behavior is identical - @data still marks as literal data
```

This ensures round-trip safety and preserves intent.
