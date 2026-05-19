# @std/regex

Standard regex operators for Expresso, providing powerful pattern matching and
string manipulation capabilities.

## Operators

### `regex_match(pattern, string)`

Tests if a string matches a regular expression pattern. Returns `true` if the
pattern matches, `false` otherwise.

```typescript
{ 'regex_match': ['^[\\w.-]+@[\\w.-]+\\.\\w+$', 'test@example.com'] }  // true
{ 'regex_match': ['^\\d{3}-\\d{3}-\\d{4}$', '555-123-4567'] }          // true
{ 'regex_match': ['^\\d+$', 'abc123'] }                                  // false
```

### `regex_replace(pattern, replacement, string)`

Replaces all occurrences of a regex pattern with a replacement string. Supports
backreferences like `$1`, `$2`, etc.

```typescript
{ 'regex_replace': ['\\d', 'X', 'Phone: 555-123-4567'] }         // 'Phone: XXX-XXX-XXXX'
{ 'regex_replace': ['\\s+', ' ', 'Hello    World'] }            // 'Hello World'
{ 'regex_replace': ['\\d{3}-\\d{2}-(\\d{4})', 'XXX-XX-$1', 'SSN: 123-45-6789'] }  // 'SSN: XXX-XX-6789'
```

### `regex_extract(pattern, string)`

Extracts all capture groups from a regex match. Returns an array where:

- Index 0 is the full match
- Subsequent indices are capture groups (1, 2, 3, etc.)

```typescript
{ 'regex_extract': ['^([A-Z])(\\d{2})(\\.\\d{1})?$', 'C12.3'] }  // ['C12.3', 'C', '12', '.3']
{ 'regex_extract': ['^(\\d{4})-(\\d{2})-(\\d{2})$', '2024-01-15'] }  // ['2024-01-15', '2024', '01', '15']
{ 'regex_extract': ['^\\d+$', 'abc'] }                             // []
```

### `regex_test(pattern, string)`

Alias for `regex_match`. Boolean test for whether a string matches a regex
pattern.

```typescript
{ 'regex_test': ['^[A-Z]+$', 'HELLO'] }          // true
{ 'regex_test': ['^https?://', 'https://example.com'] }  // true
{ 'regex_test': ['^\\d{5}$', '123456'] }          // false
```

## Installation

```bash
bun add @std/regex
```

## Usage

### Load the plugin

```typescript
import { pluginRegistry } from '/expresso';
import regexPlugin from '@std/regex';

// Load the plugin
await pluginRegistry.load(regexPlugin);

// Use operators
const result = apply(
  {
    regex_match: ['^[\\w.-]+@[\\w.-]+\\.\\w+$', 'test@example.com'],
  },
  {}
);
```

### Email validation

```typescript
const emailRule = {
  and: [
    { var: 'email' },
    { regex_match: ['^[\\w.-]+@[\\w.-]+\\.\\w+$', { var: 'email' }] },
  ],
};

const data = { email: 'user@example.com' };
const result = apply(emailRule, data); // true
```

### Extract date components

```typescript
const dateRule = {
  regex_extract: ['^(\\d{4})-(\\d{2})-(\\d{2})$', { var: 'date' }],
};

const data = { date: '2024-01-15' };
const result = apply(dateRule, data);
// ['2024-01-15', '2024', '01', '15']
```

### Sanitize input

```typescript
const sanitizeRule = {
  regex_replace: ['\\s+', ' ', { var: 'input' }],
};

const data = { input: 'Hello    World   Test' };
const result = apply(sanitizeRule, data);
// 'Hello World Test'
```

### ICD-10 code validation

```typescript
const icd10Rule = {
  regex_match: ['^[A-Z]\\d{2}(\\.\\d{1})?$', { var: 'code' }],
};

const data = { code: 'C12.3' };
const result = apply(icd10Rule, data); // true
```

## Use Cases

- **Email/phone validation** - Format checking for user input
- **ICD-9/ICD-10 medical codes** - Healthcare applications
- **URL parsing** - Extract protocol, domain, path components
- **Data sanitization** - Clean up user input (remove extra whitespace, etc.)
- **Redaction** - Mask sensitive data (SSNs, credit cards)
- **Text processing** - Pattern matching, extraction, transformation

## Notes

- All operators throw an error if the regex pattern is invalid
- `regex_replace` uses global flag (`g`) by default
- `regex_extract` returns an empty array if no match is found
- Backreferences in replacement strings: `$1`, `$2`, etc.

## License

MIT
