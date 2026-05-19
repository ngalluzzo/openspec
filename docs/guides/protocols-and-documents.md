# Protocols and Documents

A document is any YAML or JSON file with a `protocol` field. The protocol field names the handler — the TypeScript code that knows how to interpret this document and translate it into graph facts. This translation is the core of what compilation does.

## Documents

A document has three required pieces:

```yaml
# in some-file.yml
protocol: mycompany.entity.v1
id: my-service.user-model
# ... the rest is protocol-specific content
```

- **`protocol`** — which handler to use.
- **`id`** — a stable identifier for this document within the compiled graph. Provenance on every node this document produces will reference this ID.
- **The body** — everything else. Its shape is entirely up to the protocol.

When you call `compiler.compile({ documents })`, you pass the parsed document bodies alongside their IDs and protocol names:

```ts
await compiler.compile({
  documents: [
    {
      id: "my-service.user-model",
      protocol: "mycompany.entity.v1",
      document: { /* parsed YAML body */ },
      source: { path: "models/user.yml" },
    }
  ]
});
```

## Protocols

A protocol is a TypeScript object with an `id` and three lifecycle hooks:

```ts
type Protocol<TDocument> = {
  id: string;
  parse?: (document: unknown, context: ProtocolContext) => TDocument | Promise<TDocument>;
  lower:  (document: TDocument, context: ProtocolContext) => SemanticContribution | Promise<SemanticContribution>;
  validate?: (graph: SemanticGraph, context: ProtocolValidationContext) => Diagnostic[] | Promise<Diagnostic[]>;
  selectors?: Record<string, GraphSelector>;
};
```

Each hook runs at a different point in the pipeline and answers a different question.

### `parse` — is this document valid?

`parse` receives the raw, untyped document body and should return a typed, validated representation. If the document is malformed, throw here. The output of `parse` is what `lower` receives.

`parse` is optional. If you skip it, `lower` receives the raw document as-is. Many protocols skip `parse` and handle validation inside `lower` directly.

### `lower` — what does this document contribute to the graph?

`lower` is the translation layer. It receives the (optionally parsed) document and returns a `SemanticContribution`: the set of nodes, edges, and facets this document asserts.

This is where your domain language becomes graph facts:

```ts
lower(document: EntityDocument, { context }): SemanticContribution {
  const entityId = semanticNodeId("model.entity", document.name);

  return {
    protocol: context.document.protocol,
    documentId: context.document.id,
    nodes: [
      {
        id: entityId,
        kind: semanticFactKind("model.entity"),
        attributes: {
          name: document.name,
          description: document.description ?? null,
        },
      },
      ...document.fields.map((field) => ({
        id: semanticNodeId("model.field", document.name, field.name),
        kind: semanticFactKind("model.field"),
        attributes: { name: field.name, type: field.type },
      })),
    ],
    edges: document.fields.map((field) => ({
      id: semanticEdgeId(`${document.name}.${field.name}`),
      kind: semanticFactKind("model.entity.field"),
      from: entityId,
      to: semanticNodeId("model.field", document.name, field.name),
      attributes: { required: field.required ?? false },
    })),
  };
}
```

`lower` is document-scoped. It sees one document at a time and has no access to the graph or to other documents. This is intentional: lowering is a pure translation, not a cross-document analysis.

### `validate` — are the rules satisfied across the full graph?

`validate` runs after all documents have been lowered and the graph has been composed. It receives the full `SemanticGraph` and a `GraphRuntime`, so it can check invariants that span multiple documents.

```ts
validate(graph, { runtime, documents }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const node of runtime.nodes({ kind: "model.field" })) {
    const fieldType = node.attributes?.type as string;
    if (!runtime.node(`model.entity:${fieldType}`) && !SCALAR_TYPES.has(fieldType)) {
      diagnostics.push(error({
        code: "model.field.unknown-type",
        message: `Field type '${fieldType}' does not reference a known entity or scalar.`,
      }));
    }
  }

  return diagnostics;
}
```

**Why are `lower` and `validate` separate?** They answer different questions at different times. `lower` runs before composition — it can only see its own document. `validate` runs after composition — it can see everything. Putting cross-document checks in `lower` is impossible; putting all logic in `validate` means you can't build the graph until after you've checked it, which creates a chicken-and-egg problem. Keeping them separate makes the pipeline deterministic.

### Selectors

A protocol can register named selectors — pure query functions that tooling can call through `runtime.select()`:

```ts
selectors: {
  entityFields: (input: { entityId: string }, { runtime }) =>
    runtime.edges({ from: input.entityId as SemanticNodeId, kind: "model.entity.field" })
      .map((edge) => runtime.node(edge.to))
      .filter(Boolean),
}
```

Selectors are projection functions: they read from the graph and shape the result for a caller. They don't modify the graph. They're how you expose clean query APIs over graph facts without callers needing to know the node/edge/facet structure.

## Protocol packages

Protocols are usually grouped into a **ProtocolPackage** for distribution. A package bundles a set of protocols with the documents and derivation passes that belong to them:

```ts
const myPackage = defineProtocolPackage({
  id: "mycompany.core",
  version: "1.0.0",
  protocols: [entityProtocol, fieldProtocol],
  documents: [
    /* built-in documents this package always contributes */
  ],
  passes: [/* derivation passes */],
  dependencies: [anotherPackage],
});
```

When you pass a package to `createCompiler`, the compiler flattens its dependency tree, deduplicates protocols and passes, and pre-seeds any built-in documents before processing your input documents. Packages are the unit of reuse across projects.

## The pre-pass: why two protocols run first

Two built-in protocols — `openspec.protocol.v1` and `openspec.graph.v1` — are processed in a separate pre-pass before all other documents. Their output populates `protocol.lowering.map` and `selector.declaration` nodes that the dynamic lowerer and selector materializer depend on. Without these nodes, dynamic lowering (which reads lowering rules from the graph) can't run.

This is a bootstrapping constraint: the graph needs to know how to lower documents before it can lower documents. The pre-pass breaks the cycle by running a fixed set of protocols in compiled TypeScript first, before the dynamic lowering system comes online.

You don't usually need to think about this unless you're writing a protocol that needs to participate in dynamic lowering.
