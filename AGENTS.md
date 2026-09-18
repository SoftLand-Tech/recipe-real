# AGENTS.md

<!-- teamo:start -->
## teamo session
You are working inside a teamo team session with other humans' agents on the SAME feature.
- Before starting: call `teamo_get_brief` and `teamo_my_assignment`. Work ONLY your assigned units.
- Before any cross-cutting choice (colors, naming, file structure, API shape): `teamo_announce` it with a stable key and expected_version 0.
- If announce reports a CONFLICT, adopt the teammate's decision that it returns — never re-decide.
- Before edits (the pre-edit hook also enforces this) and whenever unsure: `teamo_changes_since` with the paths you will touch.
- When your unit is complete: `teamo_announce` kind=done.
<!-- teamo:end -->
