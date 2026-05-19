# Contributions and Composition

A protocol's `lower()` function doesn't produce a graph directly. It produces a **contribution** — a bag of proposed facts attributed to one document. The compiler collects contributions from every document, then **composes** them into a single unified graph. This two-step process is what makes multi-document assembly work.

## What a contribution is

A `SemanticContribution` is the output of lowering one document:

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

It is not a graph. It is an ordered list of facts waiting to be merged. Multiple contributions can assert the same node ID — that is not an error. It is the mechanism by which different documents can together describe a single logical entity.

## Why contributions, not direct graph writes?

If each document wrote directly into a shared graph, the order of processing would determine the outcome. A document processed later could silently overwrite facts from an earlier one. Cross-document relationships would create implicit dependencies on processing order.

Contributions solve this by deferring all writes. Every document produces its full set of proposed facts; then composition runs once, with full visibility into all contributions at the same time. The result is deterministic regardless of document order.

## Composition

`composeGraph` merges all contributions into a single `SemanticGraph`. Its rules are simple:

**First assertion wins for new facts.** If a node ID hasn't been seen before, it is added to the graph directly.

**Identical duplicate assertions are silently merged.** If two contributions assert the same node ID with the same `kind` and the same `attributes`, they are treated as the same fact from two sources. The node is kept once; both provenance records are attached to it.

**Conflicting assertions are a diagnostic.** If two contributions assert the same node ID with different `kind` or different `attributes`, that is a conflict. A `graph.node.conflict` diagnostic is emitted and the second assertion is discarded. The same applies to edges and facets.

This means identity via ID is a contract. If two documents both produce a node with ID `model.entity:user`, they are saying "this is the same entity." If they disagree about what that entity is, the compiler tells you.

## Multi-document assembly in practice

The intended use of identical-assertion merging is for an entity to be partially described across multiple documents. Each document contributes what it knows; composition assembles the whole.

For example, one document might define the entity structure:

```yaml
# models/user.yml
protocol: mycompany.entity.v1
id: my-service.user-model
name: User
fields:
  - name: email
    type: string
  - name: createdAt
    type: timestamp
```

A separate document might extend it with HTTP exposure:

```yaml
# routes/user-routes.yml
protocol: mycompany.http.v1
id: my-service.user-routes
routes:
  - id: users.list
    method: GET
    path: /users
    responseType: User
```

Both documents can produce facts that reference `model.entity:User`. Because IDs are content-addressed — derived from the entity name, not the file — the `User` node produced by the entity document and any reference to it produced by the routes document will share the same ID, and composition will correctly connect them.

The entity document doesn't need to know about routes. The routes document doesn't need to include the entity definition. They cooperate through shared IDs.

## Package contributions

`ProtocolPackage` instances can carry an optional `contribution` field — a pre-seeded set of facts that the package always contributes, before any document is processed:

```ts
defineProtocolPackage({
  id: "mycompany.core",
  contribution: {
    protocol: "mycompany.core",
    documentId: "mycompany.core.builtins",
    nodes: [
      {
        id: semanticNodeId("model.scalar", "string"),
        kind: semanticFactKind("model.scalar"),
        attributes: { name: "string" },
      },
      // ... other built-in scalar types
    ],
  },
});
```

Package contributions are normalized and merged alongside document contributions. They are always present, regardless of which user documents are compiled.

## Provenance across sources

When two contributions assert the same fact and it merges cleanly, provenance from both sources is preserved on the resulting node:

```ts
// The composed node carries provenance from both contributing documents
{
  id: "model.entity:user",
  kind: "model.entity",
  attributes: { name: "User" },
  provenance: [
    { protocol: "mycompany.entity.v1", documentId: "my-service.user-model", contribution: 0 },
    { protocol: "mycompany.meta.v1",   documentId: "my-service.meta",        contribution: 2 },
  ]
}
```

This is the audit trail: you can always trace any fact in the graph back to every document that contributed to it. Tooling that reports errors or generates code can cite its sources precisely.

## What happens after composition

Once `composeGraph` produces the composed graph, two more things happen before tooling gets the runtime:

1. **Derivation passes** run over the composed graph and add new facts. See [Derivation Passes](./derivation-passes.md).
2. **The graph provider** takes the enriched graph, materializes selectors, builds traversal indexes, and returns the final `GraphRuntime`.

The `GraphRuntime` your tooling receives reflects all three layers: lowered document facts, composed merges, and derived enrichments.
