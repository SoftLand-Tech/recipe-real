# Branch protection for `main` (deferred)

Server-side protection is **not active yet**: the repo is private on a free GitHub
plan, and GitHub gates both the classic protection API and Rulesets behind Pro
(or a public repo). CI is already green (`test` + `check`), so the moment either
condition changes, apply one of the options below.

## Option A — Make the repo public (free, recommended for showcase)

Settings → General → Danger Zone → Change visibility → Make public. Then apply
Option C. Public repos get full protection, badges, and social preview on free.

## Option B — Upgrade to Pro, stay private

Billing → Upgrade. Then apply Option C.

## Option C — Apply the protection (after A or B)

Via `gh` (authenticated as an admin):

```bash
# 1. Require PRs + green CI on main (solo-dev friendly: 0 required approvals,
#    but no direct pushes and no merging red PRs)
gh api repos/SoftLand-Tech/recipe-real/branches/main/protection -X PUT --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test", "check"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false
}
EOF

# 2. Verify
gh api repos/SoftLand-Tech/recipe-real/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled}'
```

Or click it: Settings → Branches → Add classic branch protection rule →
Branch name pattern `main` → Require a pull request before merging →
Require status checks to pass (`test`, `check`) → Require branches to be up to
date → Do not allow bypassing → Create.

## Workflow after protection is on

Direct `git push origin main` will be rejected (even for admins). Ship via:

```bash
git checkout -b feat/<area>-<slug>
# ... work ...
git push -u origin feat/<area>-<slug>
gh pr create --fill
# merge after test + check go green
```

`deploy.sh` on the VPS is unaffected (it pulls `main`, which will only ever
contain green, reviewed commits).
