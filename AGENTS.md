# OwlMeans Connect — Project Context

## Git Workflow (mandatory)

Before any git operation follow `.agents/rules/git.md`.

@.agents/rules/git.md

## Organization entity — naming (mandatory)

An organization entity is the customer/tenant. `entitySlug` is its renameable wire value; `entityId` is its stable database key and never appears on the wire. Bare entity also denotes a domain-model entity.

## Environments (mandatory)

Work only in the checkout identified by its path: main or the named vslot. Never touch other slots unless explicitly requested.

## Reporting (mandatory)

Report briefly in tables: changes by file and project, plus verification. Separate findings not acted on.

## Memory

Read `.agents/memory/MEMORY.md` at session start and matching nodes before non-trivial work. Follow `agent-memory`; keep memory in this repository.

## Self-Education (mandatory)

After work started from an agreed plan, apply `self-education` and report its outcome.

## Code structure (mandatory)

Load `/owlmeans-code-structure` before writing, moving or reviewing TypeScript. One domain is one factory-built object, with interface first and bound context; types, constants and code live separately.

## Project overview

Public MIT integration packages in a Bun monorepo. `libraries/common` links common; workspace entries for upstream packages are explicit. See `.agents/project-structure.md`.

## Commands

Run `./setup.sh` before `bun install`. Use `bun run build`, `bun run test`, `bun run dev`, and `bun run watch`. The private `_tpl` is excluded from root commands; build it directly when checking the template.

## Skills

Skills live in `.agents/skills/`; common skills link through `.agents/linked-skills/`.
Use `/publishing`, `/versions`, `/bun`, `/tsconfig`, `/dependency-tree` and `/create-skill` by topic.

<!-- OWLMEANS:LINKED-SKILLS -->
### Skills linked from upstream repos

`sh .agents/scripts/link-skills.sh` links upstream skills and generates the ignored index. Local skills win. Dependency order: **connect → common**.
<!-- /OWLMEANS:LINKED-SKILLS -->

## Maintenance

Guidance is single-source in `AGENTS.md`, `.agents/rules/` and `.agents/skills/`. Rewrite invalid rules in place. Never author under `.claude/skills/` or `.agents/linked-skills/`; refresh links after skill changes. `sh .agents/scripts/agents-size.sh` enforces the 40,000-character budget.

## Claude Code

Claude Code reads this file directly; there is no `CLAUDE.md`. The SessionStart hook regenerates `.claude/skills/` from canonical skills. Run `sh .agents/scripts/link-skills.sh` after creating, renaming or deleting a skill.
