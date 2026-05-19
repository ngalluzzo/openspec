# @openspec/kernel

The foundational vocabulary for OpenSpec. This package defines the data model, query interface, and primitive operations that everything else in the system builds on. It contains no compilation logic and holds no runtime state — it is a type library with a small set of constructors.

## Concept glossary

### SemanticGraph

The central data structure. A `SemanticGraph` is an immutable collection of three kinds of facts:

```
SemanticGraph = { nodes, edges, facets }
```

All three are plain arrays. The graph has no methods; queries run through a `GraphRuntime`.

---

### SemanticNode

A typed entity in the graph. Every node has:

- **`id`** — globally unique, format-validated (`kind:identifier`). Constructed with `semanticNodeId(kind, ...segments)`.
- **`kind`** — a `SemanticFactKind` string that identifies what this node represents (e.g. `"http.route"`, `"model.entity"`).
- **`attributes`** — optional `JsonObject` of intrinsic data.
- **`provenance`** — optional trace back to the document and protocol that produced it.

Node IDs are content-addressed by convention: the same logical entity always gets the same ID regardless of which document declares it. This makes multi-document composition deterministic.

---

### SemanticEdge

A directed relationship between two nodes. An edge has a `from` node, a `to` node, and its own `kind`. Edges are first-class facts: they carry attributes and provenance just like nodes.

---

### SemanticFacet

A scalar value attached to a node, tracked separately from `attributes`. Use a facet when:

- The value needs its own provenance (it comes from a different document than the node).
- The value will be queried by kind across many nodes (facets are filterable by `kind` and `target`).
- The value is logically derived rather than intrinsic to the node.

Attributes are for data that belongs to the node unconditionally. Facets are for data that annotates a node from the outside.

---

### SemanticFactKind

A branded `string` used as the type tag for nodes, edges, and facets. Constructed with `semanticFactKind(value)`. By convention, kinds are dot-namespaced (`"http.route"`, `"model.entity.field"`).

---

### GraphRuntime

The query interface over a `SemanticGraph`. A runtime wraps an immutable graph and provides:

- `node(id)` / `nodes(filter)` — look up nodes by ID or filter.
- `edge(id)` / `edges(filter)` — look up edges.
- `facet(id)` / `facets(filter)` — look up facets.
- `neighbors(id, filter)` — traverse to connected nodes.
- `uses(id)` / `usersOf(id)` — typed outgoing/incoming edge traversal.
- `select(id, input)` — run a registered `GraphSelector` by ID.
- `expectNode(nodeId, kind)` — look up a node and return a typed diagnostic if it is missing.

A runtime is always produced by the compiler after the graph is fully composed. Passes receive a runtime, not a raw graph.

---

### GraphSelector

A pure function `(input, context) => result` registered by name on the graph. Selectors project semantic facts into domain-specific shapes without modifying the graph. They are resolved at compile time and dispatched through `runtime.select(id, input)`.

---

### DerivationPass

An incremental computation over the graph. A pass declares what fact kinds it reads and what fact kinds it writes, and then derives new nodes/edges/facets from a `GraphRuntime`.

```ts
type DerivationPass = {
  id: string;
  reads: readonly string[];   // fact kinds this pass consumes
  writes: readonly string[];  // fact kinds this pass produces
  derive(context: DerivationPassContext): DerivationPassResult | Promise<DerivationPassResult>;
};
```

The `reads`/`writes` declarations are the pass's dependency contract. The compiler uses them to topologically sort passes so that every pass sees the output of any pass it depends on. A cycle in the dependency graph is a compile error. Use `defineDerivationPass` to construct a pass (identity function, present for consistency and future validation).

---

### Provenance

A `Provenance` record traces a node, edge, or facet back to its origin:

```ts
type Provenance = {
  protocol: string;     // which protocol produced this fact
  documentId: string;   // which document it came from
  contribution: number; // index within the document's contribution
  source?: SourceRef;   // optional byte-range in the source file
};
```

Multiple contributions can assert the same node ID. When they do, provenance from all sources is merged onto the single composed node, so the graph always reflects where each fact came from.

---

### Diagnostic

A structured message produced during compilation:

```ts
type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source?: DiagnosticSource;
  details?: Record<string, unknown>;
};
```

Constructed with the `error()`, `warning()`, or `info()` helpers. Diagnostics are collected, never thrown — the compiler always returns a result even when errors are present.

---

## Package boundary

`@openspec/kernel` defines *what* the graph is. It does not:

- Parse or lower documents.
- Register or run protocols.
- Execute passes or compose graphs.
- Hold any mutable state.

All of that lives in `@openspec/compiler`.
