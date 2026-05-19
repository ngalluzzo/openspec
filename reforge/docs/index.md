---
layout: home

hero:
  name: "Reforge"
  text: Format-preserving codemods
  tagline: A TypeScript framework for safe, format-preserving AST transformations across multiple languages.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/overview
    - theme: alt
      text: GitHub
      link: https://github.com/reforgejs/reforge
  features:
    - title: Format-Preserving
      details: Unmodified source is emitted verbatim. Only changed portions are reprinted, preserving all formatting and whitespace.
      link: /core/overview
    - title: Query API
      details: CSS-style selectors, chainable mutations, and a Path object with navigation and comment management.
      link: /transform/overview
    - title: Recipe System
      details: Compose codemods with dependencies, run lint rules, scaffold templates — all with typed options and structured reporting.
      link: /recipes/overview
    - title: Language-Agnostic
      details: Plug in any parser with the ParserAdapter interface. TypeScript and CSS adapters included.
      link: /core/adapters
---
