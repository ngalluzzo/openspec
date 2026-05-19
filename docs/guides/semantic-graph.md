# The Semantic Graph

The semantic graph is the central data structure in OpenSpec. Everything the compiler produces, and everything downstream tooling consumes, lives here. Understanding it is the prerequisite for understanding everything else.

## Why a graph?

The things OpenSpec models — APIs, data models, services, operations — are inherently relational. An HTTP route uses a request body type. That type has fields. Each field references another type. An operation is grouped into a resource. A resource belongs to a domain.

You could represent this as a tree, but trees break down the moment a node has more than one parent. You could use plain JSON objects with ID references, but then relationships are implicit strings rather than first-class facts. A graph makes relationships explicit, traversable, and typed.

## Three primitives

The `SemanticGraph` is made of exactly three kinds of facts:

```ts
type SemanticGraph = {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  facets: SemanticFacet[];
};
```

Each plays a distinct role. It's worth understanding why all three exist rather than collapsing them.

### Nodes — the entities

A node represents a thing: a type, a field, a route, an operation, a service. Every node has:

- **`id`** — a globally unique, content-addressed string in the format `kind:identifier` (e.g. `model.entity:user`, `http.route:users.list`).
- **`kind`** — a dot-namespaced string identifying what kind of thing this is.
- **`attributes`** — a `JsonObject` of data intrinsic to this node.

```ts
// A node representing a data model entity
{
  id: "model.entity:user",
  kind: "model.entity",
  attributes: { name: "User", description: "A registered user" }
}
```

### Edges — relationships as facts

An edge is a directed relationship between two nodes. It has its own `kind`, its own `attributes`, and its own `id`. Edges are not just pointers — they are facts in the graph with the same status as nodes.

```ts
// The relationship between a field and the entity that owns it
{
  id: "model.entity.field:user.email",
  kind: "model.entity.field",
  from: "model.entity:user",
  to: "model.field:email",
  attributes: { required: true }
}
```

Making relationships first-class lets you query them by kind, filter them, and attach provenance to them. If you later want to know "which fields on this entity are required", that's a graph query, not string parsing.

### Facets — external assertions

A facet attaches a scalar value to a node from outside that node's own contribution. Think of it as a sticky note on a node written by someone other than the node's author.

```ts
// A validation rule annotating a field node, contributed by a separate document
{
  id: "validation.rule:user.email.format",
  kind: "validation.rule",
  target: "model.field:email",
  value: "email"
}
```

The distinction between a facet and a node attribute matters when:

- The value comes from a different document than the node it annotates.
- The value is computed by a derivation pass, not declared by any document.
- You want to query "all nodes with a facet of kind X" across the entire graph.

If you put derived or cross-document data into node attributes, you lose the ability to tell where it came from. Facets keep attribution clean.

## Content-addressed IDs

Node IDs follow a strict format: `kind:identifier`. The identifier is always derived from the thing's logical identity — its name, its path, its structural position — never from file location or parse order.

```ts
semanticNodeId("model.entity", "user")         // → "model.entity:user"
semanticNodeId("http.route", "users", "list")   // → "http.route:users.list"
```

This is intentional. Because two documents that independently describe the same thing will produce the same ID, the compiler can merge their contributions into a single node. Content-addressed IDs are what make multi-document composition work without a coordination layer.

The ID format is validated at construction time in development. IDs that don't match `^[a-z][a-z0-9.]+:[^:]+$` throw immediately, catching typos before they produce silent graph corruption.

## Kinds as the type system

`SemanticFactKind` is the graph's type system. It's a branded string — not an enum, not a class hierarchy — so protocols can define their own kinds without registering them centrally.

By convention, kinds are dot-namespaced and match the `id` prefix of the nodes they describe:

```
model.entity         → nodes representing data model entities
model.entity.field   → edges connecting entities to their fields
http.route           → nodes representing HTTP routes
http.route.param     → edges connecting routes to their parameters
```

This convention makes the graph self-describing. If you see a node with kind `http.route`, you know its ID starts with `http.route:` and you can infer what edges and facets are likely attached to it.

## Provenance

Every node, edge, and facet can carry a list of `Provenance` records:

```ts
type Provenance = {
  protocol: string;   // which protocol produced this fact
  documentId: string; // which document it came from
  contribution: number;
  source?: SourceRef; // byte-range in the source file
};
```

Provenance is how you answer "where did this come from?" when something is wrong. It is also how multi-document composition works: when two documents both describe the same node, their provenance records are merged onto the single composed node, so the graph always reflects all of its origins.

## The graph is immutable

A `SemanticGraph` is a plain data structure — plain arrays of plain objects. It has no methods and no mutation API. All query operations happen through a `GraphRuntime`, which wraps a graph snapshot.

The compiler composes a new graph; derivation passes produce additive facts that are merged into a new graph; the graph provider takes the final graph and builds an indexed, queryable runtime from it. At each step, the graph is assembled, not mutated.

This means any piece of tooling that holds a runtime is working against a stable snapshot. Tooling cannot accidentally corrupt the graph.

## Querying with GraphRuntime

The `GraphRuntime` is what tooling actually uses. It provides:

```ts
// Look up a specific node by ID
runtime.node("model.entity:user")

// Find all nodes of a given kind
runtime.nodes({ kind: "http.route" })

// Find edges connecting two nodes
runtime.edges({ from: "model.entity:user", kind: "model.entity.field" })

// Traverse neighbors
runtime.neighbors("model.entity:user", { kind: "model.entity.field", direction: "out" })

// Typed ownership traversal
runtime.uses("http.route:users.list")       // nodes this route uses
runtime.usersOf("model.entity:user")        // nodes that reference this entity

// Run a registered selector
runtime.select(mySelector, { entityId: "model.entity:user" })
```

All query methods accept optional filters. `nodes()` without a filter returns all nodes. `edges({ from: id })` returns all outgoing edges from that node.

The runtime also exposes the raw `graph` for cases where you need to work with the full arrays directly.
