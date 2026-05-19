# @std/crypto

Standard crypto operators for Expresso, providing cryptographic operations for
security, validation, and encoding.

## Operators

### `hash(algorithm, string)`

Compute hash of a string using specified algorithm. Supports SHA-1, SHA-256,
SHA-384, and SHA-512.

```typescript
{ 'hash': ['SHA-256', 'Hello, World!'] }
// Returns: 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'

{ 'hash': ['SHA-1', 'Hello, World!'] }
// Returns: '0a0a9f2a6772942557ab5355d76af442f8f65e01'
```

**Note:** This is an async operator. Use `applyAsync()` when using `hash`.

### `hmac(algorithm, key, message)`

Compute HMAC signature of a message using specified algorithm and key.

```typescript
{ 'hmac': ['SHA-256', 'secret-key', 'message-to-sign'] }
// Returns: hex-encoded HMAC signature
```

**Note:** This is an async operator. Use `applyAsync()` when using `hmac`.

### `uuid_generate()`

Generate a random UUID v4.

```typescript
{ 'uuid_generate': [] }
// Returns: '550e8400-e29b-41d4-a716-446655440000'
```

### `uuid_validate(string)`

Validate if a string is a valid UUID v4 format.

```typescript
{ 'uuid_validate': ['550e8400-e29b-41d4-a716-446655440000'] }  // true
{ 'uuid_validate': ['not-a-uuid'] }                                // false
```

### `base64_encode(string)`

Encode a string to Base64.

```typescript
{ 'base64_encode': ['Hello, World!'] }
// Returns: 'SGVsbG8sIFdvcmxkIQ=='
```

### `base64_decode(string)`

Decode a Base64 string.

```typescript
{ 'base64_decode': ['SGVsbG8sIFdvcmxkIQ=='] }
// Returns: 'Hello, World!'
```

## Installation

```bash
bun add @std/crypto
```

## Usage

### Load the plugin

```typescript
import { pluginRegistry } from '/expresso';
import cryptoPlugin from '@std/crypto';

// Load the plugin
await pluginRegistry.load(cryptoPlugin);
```

### Password hashing

```typescript
import { applyAsync } from '/expresso';

const passwordRule = {
  hash: ['SHA-256', { var: 'password' }],
};

const data = { password: 'user_password' };
const hash = await applyAsync(passwordRule, data);
// Returns: SHA-256 hash of password
```

### Generate unique IDs

```typescript
const idRule = { uuid_generate: [] };
const userId = apply(idRule, {});
// Returns: random UUID v4
```

### Validate UUID input

```typescript
const validateRule = {
  uuid_validate: [{ var: 'userId' }],
};

const data1 = { userId: '550e8400-e29b-41d4-a716-446655440000' };
const data2 = { userId: 'invalid' };

console.log(apply(validateRule, data1)); // true
console.log(apply(validateRule, data2)); // false
```

### Base64 encoding/decoding

```typescript
const encodeRule = {
  base64_encode: [{ var: 'message' }],
};

const decodeRule = {
  base64_decode: [{ var: 'encoded' }],
};

const data = { message: 'Hello, World!' };
const encoded = apply(encodeRule, data); // 'SGVsbG8sIFdvcmxkIQ=='
const decoded = apply(decodeRule, { encoded }); // 'Hello, World!'
```

### Webhook signature verification

```typescript
const verifyRule = {
  '==': [
    { var: 'headers.x-signature' },
    { hmac: ['SHA-256', 'webhook_secret', { var: 'body' }] },
  ],
};

const data = {
  headers: { 'x-signature': 'abc123...' },
  body: JSON.stringify({ event: 'user.created' }),
};

const isValid = await applyAsync(verifyRule, data);
// Returns: true if signature matches
```

## Use Cases

- **Password hashing** - Securely hash passwords for storage
- **Webhook signature verification** - Verify authenticity of webhooks
- **JWT-like token generation** - Generate and validate tokens
- **Data encoding** - Base64 encoding for API data
- **Unique ID generation** - Create UUIDs for entities
- **Input validation** - Validate UUID format from user input
- **API signatures** - Sign API requests with HMAC

## Notes

- `hash` and `hmac` are async operators. Use `applyAsync()` instead of `apply()`
- Supported hash algorithms: SHA-1, SHA-256, SHA-384, SHA-512
- HMAC uses the same set of supported algorithms
- `base64_decode` throws an error for invalid Base64 strings
- UUID generation follows RFC 4122 v4 specification

## License

MIT
