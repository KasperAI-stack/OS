# Skills

A skill packages a recurring, well-defined workflow so any agent can run it consistently instead of improvising each time — e.g. "produce the weekly status update," "build a campaign brief," "check budget pacing." Agents (see `.claude/agents/`) stay generalist per domain; skills are the repeatable procedures within that domain.

## Structure

```
.claude/skills/<skill-name>/
  SKILL.md          required — frontmatter + instructions
  (supporting files) optional — reference docs, scripts, templates the skill needs
```

`<skill-name>` is kebab-case and matches the `/‹skill-name›` slash command used to invoke it.

## SKILL.md format

```markdown
---
name: skill-name
description: One line stating what it does and WHEN to use it — this is what triggers auto-invocation, so be specific about the trigger, not just the output.
---

Step-by-step instructions for the workflow: what to check, what order to do things in,
where to read input from and write output to (usually somewhere under `reference/`,
`projects/`, `reports/`, or `templates/`), and any conventions specific to this task.
```

Copy `_template/SKILL.md` as a starting point for a new skill.

## When to add one

Only once a workflow has actually repeated — don't pre-build skills for hypothetical recurring tasks. Good candidates as they emerge:
- `personal-assistant`: weekly status report generation
- `marketing-specialist`: campaign brief → launch checklist
- `art-director`: brand-template-based asset generation for a given placement
- `cfo`: budget variance check against a project

None of these exist yet — add them here as real workflows settle.

## Design

- `ui-design/` — design og byg flot, brugbar UI (HeyOtto Tasks, Hey Otto, landingssider). Tre lag: opbygning (uddrag af `ui-ux-pro-max`), flot design (principper fra referencebiblioteket `reference/design/`) og et tjek for AI slop (fra `detect-slop-ui` og `frontend-design`). Læser altid `references/smag-og-laeringer.md` med Kaspers feedback først.

## Third-party skills

- `detect-slop-ui/` — audits screenshots, live sites or frontend code for generic "AI slop" UI tropes and recommends or implements product-specific fixes. From [who/skills](https://github.com/who/skills/tree/main/.claude/skills/detect-slop-ui), MIT. Copied 2026-11-07 from the user-level copy (`~/.claude/skills/detect-slop-ui`, the one installed for Studio), unchanged. To update: re-copy from upstream.
- `ui-ux-pro-max/` — UI/UX design intelligence (styles, palettes, font pairings, UX guidelines, stack-specific rules) with a local, offline Python search tool. From [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), MIT. Installed 2026-11-07 without the upstream tests; script paths in SKILL.md changed from `${CLAUDE_PLUGIN_ROOT}/…` to the project path `.claude/skills/ui-ux-pro-max/…`. To update: re-clone and re-copy, then redo that path change.
