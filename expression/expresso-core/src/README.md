# expresso source layout

- `runtime/`: runtime execution domains (see `runtime/README.md`):
  - `compile/`: apply/compile entrypoints, rule builder, static analysis, optimizer
  - `engine/`: sync/async evaluators, dispatch internals, and engine error taxonomy
  - `contracts/`: canonical runtime type contracts
  - `bootstrap/`: operator/plugin runtime initialization lifecycle
  - `tracing/`: trace formatting and filtering helpers
  - `shared/`: runtime utility primitives
- `operators/`: operator registration/definition, signatures, and runtime argument validation.
- `errors/`: structured error envelopes, catch utilities, and error formatting helpers.
- `plugin/`: plugin contracts, plugin registry, and plugin CLI helpers.
- `documentation/`: metadata-driven docs generation and CLI entrypoints.
- `testing/`: metadata validation and plugin verification helpers exposed via `expresso/testing/*`.
- `scaffolding/`: plugin scaffolding CLI helpers.
- `types/metadata.ts`: operator metadata contracts shared across runtime/docs/testing.
- `test/`: package-level runtime and behavior tests.

Keep app/runtime host composition and persistence adapters outside this package.
