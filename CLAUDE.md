# AI Trends Dashboard

## Database Rule

When adding or modifying sources (or any schema/data change), always apply
the change to the live Supabase database in addition to creating migration
files and updating setup scripts. Migration files do not auto-apply.

## Documentation Update Rule

After any structural change (workflow steps added/removed, new workflows,
rule changes, file structure changes, new dependencies), update both:
1. `docs/product-spec.md` — reflect the change in the spec
2. `docs/architecture.png` — regenerate the diagram from `docs/architecture.mmd`

## Verification Rule

After completing a development task, verify the changes work by launching
the dev server and testing via Playwright (browser snapshot / screenshot).
Check that affected pages render correctly and new UI elements appear as
expected.

## Skills

- **product-docs**: After structural changes, run the `product-docs` skill at `C:\Users\YairBederman\.gemini\antigravity\scratch\skills-hub\engineering\product-docs\SKILL.md` to keep the product spec and architecture diagram in sync.
