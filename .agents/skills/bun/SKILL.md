---
name: bun
description: "Bun workspace operations for connect. Use when installing, building, testing or changing workspace links."
---

# Bun — connect

Run `./setup.sh` then `bun install`. Bun 1.4.2 uses hoisted linking. Root scripts target `packages/*`, excluding `_tpl`; build the template directly from its directory. List each common workspace package explicitly and use semver caret dependencies. Install consumers before common.
