# Derivation Passes

Protocols translate individual documents into graph facts. But some facts can't come from any single document — they emerge from patterns across the assembled graph. A field that resolves to an unknown type. A route that has no documented response. A model that is referenced but never defined. These cross-cutting insights require seeing the full graph before they can be expressed.

Derivation passes are how you compute those facts.

## What a pass is

A derivation pass is a pure function over a `GraphRuntime` that returns new nodes, edges, and facets:

```ts
type DerivationPass = {
  id: string;
  phase?: string;
  reads: readonly string[];
  writes: readonly string[];
  derive(context: DerivationPassContext): DerivationPassResult | Promise<DerivationPassResult>;
};
```

It reads from the graph; it returns new facts to add to the graph. It never modifies the graph in place. The compiler merges its output into the graph alongside protocol contributions, then makes the enriched graph available to subsequent passes.

A minimal pass looks like this:

```ts
const labelSummaryPass = defineDerivationPass({
  id: "mycompany.label-summary",
  reads: ["model.entity"],
  writes: ["model.entity.summary"],
  derive({ runtime }) {
    return {
      facets: runtime.nodes({ kind: "model.entity" }).map((node) => ({
        id: semanticFacetId(`label-summary:${node.id}`),
        kind: semanticFactKind("model.entity.summary"),
        target: node.id,
        value: `Entity: ${node.attributes?.name ?? node.id}`,
      })),
    };
  },
});
```

## The `reads` and `writes` declarations

Every pass must declare which fact kinds it reads and which it writes. These declarations are not documentation — they are the dependency contract the compiler uses to order passes correctly.

```ts
defineDerivationPass({
  id: "mycompany.resolve-types",
  reads: ["model.field", "model.entity"],   // this pass reads these kinds
  writes: ["model.field.resolved-type"],     // this pass produces these kinds
  derive({ runtime }) { ... }
});
```

Before running any pass, the compiler builds a dependency graph from these declarations: if pass B reads `"model.field.resolved-type"` and pass A writes `"model.field.resolved-type"`, then pass A must run before pass B. This is topologically sorted automatically. You declare intent; the compiler handles sequencing.

**A cycle in the dependency graph is a compile error.** If pass A writes what pass B reads, and pass B writes what pass A reads, neither can run first. Design passes to be acyclic: each pass enriches the graph in one direction.

## Passes are incremental

Each pass receives a graph that already includes the output of every pass that ran before it. When pass A writes `model.field.resolved-type` nodes and pass B reads `model.field.resolved-type`, pass B's runtime already contains pass A's output.

This is what makes passes composable. You can chain enrichment steps:

```
Pass 1: model.field  →  model.field.resolved-type
Pass 2: model.field.resolved-type  →  model.entity.coverage
Pass 3: model.entity.coverage  →  model.service.completeness
```

Each step is simple and testable in isolation. The composition of all three is automatically ordered and sequenced.

## When to use a pass vs protocol `validate`

Both passes and `validate` hooks run after composition and have access to the full graph. The distinction is in what they produce:

| | `validate` | Derivation pass |
|---|---|---|
| **Output** | Diagnostics | Nodes, edges, facets |
| **Purpose** | Check constraints | Add derived facts |
| **Runs after** | Graph is fully composed + passes have run | Graph is composed; prior passes have run |
| **Can produce** | Errors, warnings, info | New graph facts + diagnostics |

Use `validate` when you want to check something is true and report it if not. Use a pass when you want to compute something and add it to the graph so other code can query it.

A pass can also return diagnostics alongside its graph facts — useful when the derivation itself reveals a problem:

```ts
derive({ runtime }) {
  const nodes: SemanticNode[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const field of runtime.nodes({ kind: "model.field" })) {
    const typeName = field.attributes?.type as string;
    const resolved = runtime.node(`model.entity:${typeName}`) ?? runtime.node(`model.scalar:${typeName}`);

    if (resolved) {
      nodes.push({
        id: semanticNodeId("model.field.resolved-type", String(field.id)),
        kind: semanticFactKind("model.field.resolved-type"),
        attributes: { resolvedId: resolved.id },
      });
    } else {
      diagnostics.push(error({
        code: "model.field.unresolved-type",
        message: `Field type '${typeName}' could not be resolved.`,
      }));
    }
  }

  return { nodes, diagnostics };
}
```

## Registering passes

Passes are registered either directly on the compiler or inside a `ProtocolPackage`:

```ts
// Directly on the compiler
const compiler = createCompiler({
  passes: [labelSummaryPass, resolveTypesPass],
});

// Inside a package — passes travel with the package
const myPackage = defineProtocolPackage({
  id: "mycompany.core",
  protocols: [entityProtocol],
  passes: [labelSummaryPass, resolveTypesPass],
});
```

Package-registered passes and compiler-registered passes are pooled together, deduplicated by ID, then sorted as a group. The ordering is global across all passes regardless of which package contributed them.

## Compilation phases

The topological sort within a single pool of passes handles intra-pass ordering — pass A runs before pass B because B reads what A writes. But some ordering problems can't be expressed this way.

Consider reference resolution: you have many declaration passes (each protocol contributes its own) and a single resolution pass that needs to see *all* declarations before it starts. You can't express "run after every declaration pass" purely through `reads`/`writes` because the resolution pass doesn't know which specific passes will be present.

**Phases solve this.** A phase is a named checkpoint. All passes in a phase complete before any pass in the next phase begins. Within a phase, the topological sort still applies. Between phases, you get a hard barrier.

Define the phase order on the compiler:

```ts
const compiler = createCompiler({
  phases: ["declare", "resolve", "analyze"],
  passes: [...],
  packages: [...],
});
```

Assign passes to phases:

```ts
const collectDeclarationsPass = defineDerivationPass({
  id: "mycompany.collect-declarations",
  phase: "declare",
  reads: ["model.entity"],
  writes: ["model.entity.declaration"],
  derive({ runtime }) { ... },
});

const resolveReferencesPass = defineDerivationPass({
  id: "mycompany.resolve-references",
  phase: "resolve",
  reads: ["model.entity.declaration", "model.field"],
  writes: ["model.field.resolved-type"],
  derive({ runtime }) { ... },
});
```

When the compiler runs, `collectDeclarationsPass` and all other `"declare"` passes complete first — regardless of which packages contributed them. Only then does `resolveReferencesPass` run, with the guarantee that every declaration pass has already written its output.

**Passes without a `phase` go into `"default"`**, which runs after all explicitly named phases. This means existing passes without phases continue to work without any changes — they simply execute after the named phases complete.

Phases are particularly useful for:

- **Reference resolution** — collect all declarations in one phase, resolve references in the next.
- **Inheritance and extension** — flatten inherited facts once all base declarations are present.
- **Cross-protocol matching** — match capability declarations to implementations once both sides are fully declared.
- **Staged validation** — produce coverage or completeness facts in a late phase, after all enrichment has run.

## Passes are not for validation of individual documents

A pass sees the graph after all documents have been composed. It does not have access to the source documents, the raw YAML bodies, or any per-document context. If you need to validate that a single document is internally consistent, that belongs in `protocol.parse` or `protocol.lower`. If you need to check invariants across the composed graph, that belongs in `protocol.validate` or a pass that returns diagnostics.
