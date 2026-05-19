# @openspec/compiler

The compilation pipeline for OpenSpec. Takes a set of documents, protocols, and packages as input and produces a fully composed `SemanticGraph`, a `GraphRuntime`, and a list of diagnostics.

```ts
const compiler = createCompiler({ protocols, packages, passes });
const { graph, runtime, diagnostics } = await compiler.compile({ documents });
```

## Key concepts

### Protocol

A protocol is a handler for a specific document kind. It has three lifecycle hooks:

- **`parse`** (optional) — validates and transforms the raw document into a typed shape.
- **`lower`** — converts the parsed document into a `SemanticContribution` (nodes, edges, and facets to add to the graph).
- **`validate`** (optional) — runs after the full graph is composed; returns diagnostics.

Protocols may also register named `selectors` that are available through `runtime.select()`.

---

### SemanticContribution

The output of a protocol's `lower()` call. A contribution is not yet a graph; it is a bag of nodes, edges, and facets attributed to one document:

```ts
type SemanticContribution = {
  protocol: string;
  documentId: string;
  nodes?: SemanticNode[];
  edges?: SemanticEdge[];
  facets?: SemanticFacet[];
  diagnostics?: Diagnostic[];
};
```

Contributions are composed into a unified graph by `composeGraph`. When two contributions assert a node with the same ID, their attributes and provenance are merged — this is the intended mechanism for multi-document construction of a single logical entity.

---

### ProtocolPackage

A bundle that groups related protocols, documents, derivation passes, and an optional seeded contribution. Packages declare their dependencies on other packages; the compiler flattens the dependency tree and deduplicates before compilation.

```ts
type ProtocolPackage = {
  id: string;
  protocols: readonly Protocol[];
  documents: readonly CompileDocumentInput[];
  passes?: readonly DerivationPass[];
  contribution?: SemanticContribution;
  dependencies: readonly ProtocolPackage[];
};
```

A package's `contribution` is pre-seeded into the graph before any document is lowered. Use it for facts that are intrinsic to the package rather than to any document.

---

### Capability slots

Extension points injected into `createCompiler`. Each slot wraps a piece of infrastructure that can vary at runtime:

| Slot | Purpose |
|---|---|
| `graphProvider` | Produces the final `GraphRuntime` after passes run (default: in-memory) |
| `dynamicLowering` | Lowers documents whose protocol is not registered as a TypeScript `Protocol` |
| `dynamicValidation` | Validates the graph with logic that lives outside compiled TypeScript |
| `expressionEvaluator` | Evaluates expression values embedded in documents |

---

## Compilation pipeline

```
documents + protocols + packages
        │
        ▼
1. Protocol registration
        │
        ▼
2. Pattern expansion
        │
        ▼
3. Document normalization
        │
        ▼
4. Pre-pass lowering  (openspec.protocol.v1, openspec.graph.v1 only)
        │
        ▼
5. Dynamic lowerer preparation
        │
        ▼
6. Main-pass lowering  (all other documents)
        │
        ▼
7. Graph composition
        │
        ▼
8. Derivation passes  (topologically sorted)
        │
        ▼
9. Graph provider
        │
        ▼
10. Protocol validation + dynamic validation
        │
        ▼
graph + runtime + diagnostics + trace
```

### 1. Protocol registration

`collectProtocolPackages` flattens the package dependency tree and collects all protocols, documents, and passes into a single registry. Built-in protocols (`openspec.graph.v1`, `openspec.protocol.v1`, `openspec.pattern.v1`, `openspec.provider.v1`) are prepended automatically.

### 2. Pattern expansion

Documents declared with protocol `openspec.pattern.v1` are expanded into their target documents before normalization. Patterns are a template mechanism; after expansion, the pattern documents themselves are discarded.

### 3. Document normalization

All document inputs (from packages and from `compile({ documents })`) are normalized into a consistent internal shape with a stable `id`, resolved `protocol`, and an optional `source` reference.

### 4. Pre-pass lowering

Two protocols are lowered before everything else: `openspec.protocol.v1` and `openspec.graph.v1`. Their lowered output populates `protocol.lowering.map` and `selector.declaration` nodes in a partial graph. This partial graph is available to the dynamic lowerer and selector materializer before any main-pass document is touched.

### 5. Dynamic lowerer preparation

If a `dynamicLowering` slot is configured, its `prepare()` is called once with the pre-pass graph. The returned handle is reused for every main-pass document. This lets the dynamic lowerer compile or cache any rules it needs from the pre-pass graph.

### 6. Main-pass lowering

Each remaining document goes through:

1. `protocol.parse()` — optional typed parsing.
2. `protocol.lower()` — produces a `SemanticContribution`.

If the document's protocol is not registered, the dynamic lowerer is tried first. If neither handles it, an `protocol.unknown` diagnostic is emitted and the document is skipped.

When a dynamic lowerer is present, it takes priority over the compiled `lower()` for all main-pass documents — it can override any registered protocol's lowering.

### 7. Graph composition

All contributions (from packages, pre-pass, and main-pass) are merged into a single `SemanticGraph` by `composeGraph`. Nodes with the same ID are merged; conflicting attribute values produce a diagnostic. Edges and facets are deduplicated by ID.

### 8. Derivation passes

TypeScript `DerivationPass` instances run in topological order determined by their `reads`/`writes` declarations. Each pass receives a `GraphRuntime` over the graph as it stands after all prior passes. A pass's output is folded into the graph before the next pass runs, so later passes see earlier passes' facts.

### 9. Graph provider

The composed+enriched graph is handed to the `graphProvider` slot, which performs any graph-resident enrichment (dynamic derivation, selector materialization, index building) and returns the final `GraphRuntime`. The default provider is an in-memory implementation that materializes selectors and builds traversal indexes.

### 10. Validation

Protocol `validate()` hooks run in registration order over the final graph. The optional `dynamicValidation` slot runs last. Diagnostics from both are collected into the result.

---

## Strict mode

When `createCompiler({ strict: true })`, `coverage.gap` nodes in the final graph are promoted to errors. Coverage gaps are produced when a realization request has no fulfillment — strict mode makes gaps fatal rather than silent.
