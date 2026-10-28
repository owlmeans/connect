---
name: tsconfig
description: "TypeScript configuration for connect packages. Use when creating packages or changing tsconfigs."
---

# Tsconfig — connect

Extend `@owlmeans/dep-config/tsconfig.base.json` by package name. Add the node, bun, server or react overlay only when needed. Set `rootDir` and `outDir` per package, and keep tests outside the build. Public packages may ship source and declaration maps.
