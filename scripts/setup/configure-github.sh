#!/usr/bin/env bash
# One-time GitHub setup for a repository created from this template.
#  - creates the governance labels
#  - protects the default branch: PRs only, required checks quality-gate + governance-gate,
#    no force pushes, rules apply to admins too (WF-05 hard gate)
#  - optionally replaces the @OWNER placeholder in CODEOWNERS
#  - optionally marks the repo as a GitHub template
#
# Usage: blueprint setup-github [--repo owner/name] [--reviews N] [--codeowner @handle] [--template]
#   --reviews N     required approving reviews (default 1). Use 0 for solo projects: GitHub does
#                   not let you approve your own PR, so 1 would block you.
#   --codeowner     replaces @OWNER in .github/CODEOWNERS (local file change; commit it yourself)
#   --template      marks the repository as a template repository
# Requires: gh (authenticated with admin rights on the repo).
# Note: branch protection on private repositories needs GitHub Pro/Team or higher.
set -euo pipefail

repo=""; reviews=1; codeowner=""; template=false
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --reviews) reviews="$2"; shift 2 ;;
    --codeowner) codeowner="$2"; shift 2 ;;
    --template) template=true; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Unknown option $1" >&2; exit 1 ;;
  esac
done
[ -n "$repo" ] || repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
branch=$(gh repo view "$repo" --json defaultBranchRef --jq .defaultBranchRef.name)
echo "Configuring $repo (default branch: $branch)"

echo "→ labels"
label() { gh label create "$1" --repo "$repo" --color "$2" --description "$3" --force >/dev/null && echo "  $1"; }
label "feature-request"           "1D76DB" "New feature or change request"
label "wf-01:define"              "5319E7" "WF-01: have an agent draft a feature spec"
label "wf-01"                     "5319E7" "Created by WF-01"
label "ai-proposal"               "5319E7" "Proposed by an AI workflow; needs human review"
label "blueprint-sync"            "5319E7" "WF-06 blueprint synchronization"
label "blueprint-proposal"        "FBCA04" "Proposed change to product intent"
label "blueprint:approved-change" "B60205" "Owner approves changing an approved spec (check-protected)"
label "api:breaking-approved"     "B60205" "API owner accepts a breaking contract change (WF-04)"
label "deviation"                 "FBCA04" "Implementation intentionally differs from the blueprint"
label "health-report"             "0E8A16" "WF-07 Product Engineering Health Report"
label "quality-gate-failure"      "B60205" "WF-05 failed on main"

echo "→ branch protection on $branch"
if [ "$reviews" -gt 0 ]; then
  reviews_json="{\"required_approving_review_count\": $reviews, \"require_code_owner_reviews\": true, \"dismiss_stale_reviews\": true}"
else
  reviews_json="null"
fi
gh api -X PUT "repos/$repo/branches/$branch/protection" --input - >/dev/null <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["quality-gate", "governance-gate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": $reviews_json,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
echo "  required checks: quality-gate, governance-gate · reviews: $reviews · admins included"
if [ "$reviews" -eq 0 ]; then
  echo "  note: with 0 required reviews, a PR still has to go through both checks before it can merge."
fi

if [ -n "$codeowner" ]; then
  echo "→ CODEOWNERS: @OWNER → $codeowner"
  sed -i.bak "s|@OWNER|$codeowner|g" .github/CODEOWNERS && rm -f .github/CODEOWNERS.bak
  echo "  updated .github/CODEOWNERS locally. Commit it through a PR."
fi

if $template; then
  echo "→ marking as template repository"
  gh api -X PATCH "repos/$repo" -F is_template=true >/dev/null
fi

cat <<EOF

Done. Remaining manual steps:
  1. Add the secret ANTHROPIC_API_KEY:  gh secret set ANTHROPIC_API_KEY --repo $repo
  2. Recommended: a GitHub App or fine-grained token as secret GOVERNANCE_BOT_TOKEN, so PRs opened by
     WF-01/WF-06 trigger the WF-05 checks (PRs opened with the default GITHUB_TOKEN don't).
  3. Settings → Actions → General → allow GitHub Actions to create pull requests.
  4. Connect Lovable to a working branch, not $branch (governance/agents/lovable-knowledge.md).
EOF
