---
name: publishing
description: "Publish public connect packages using the library-manager release harness. Use when adding packages or preparing a release."
---

# Publishing — connect

Packages use MIT, public npm access, source-inclusive TypeScript builds and semver dependencies. `_tpl` is private and excluded from releases. From the sibling library-manager, use `bun run scripts/publish.ts --project connect --dry-run` for a preview, and `bun run scripts/sync-agent-meta.ts --project connect --canonical-repo https://github.com/owlmeans/connect` to generate package guidance. Classify canonical skills in the manager routing table. Follow `owlmeans-publishing` for release sequencing; publishing requires explicit operator instruction.
