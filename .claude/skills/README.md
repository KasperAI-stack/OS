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
