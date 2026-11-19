# Contributing

Thanks for helping. This repository is two things at once:

- **The template**: `AGENTS.md`, `blueprint/`, `governance/`, `scripts/`, `.github/`, `.claude/`, `contracts/`, `templates/`. This is what ends up in other people's projects.
- **The installer** (`product-blueprint` on npm): `bin/`, `cli/`, `test/`, `package.json`. It copies the template into a project.

The repository follows its own rules: read [`AGENTS.md`](AGENTS.md) first. Every PR fills in the *Blueprint impact* table of the PR template, and the `quality-gate` and `governance-gate` checks must pass.

## Development

Requirements: Node ≥ 20 and git. There are no dependencies to install.

```bash
npm test                                          # installer tests (node:test)
node bin/blueprint.mjs init /tmp/try --dry-run    # try the installer locally
node scripts/governance/check-blueprint.mjs       # the template's own checks (see AGENTS.md §6)
```

- When you add a file to the template, check whether `cli/manifest.mjs` needs an entry and how it should behave when the file already exists in a project (`managed`, `seed`, `block`, `json`, `lines`).
- When you change `.gitignore`, copy it to `cli/gitignore.txt` (a test checks they match; npm never packs `.gitignore`).
- Files in `.github/workflows/package-*.yml` are this repository's own CI and are never installed.
- Add a line under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md) for anything a user would notice.

## Releasing

1. Open a PR that moves the `Unreleased` entries in `CHANGELOG.md` under a new `## [x.y.z] - YYYY-MM-DD` heading and bumps `version` in `package.json` (`npm version <patch|minor|major> --no-git-tag-version`, which updates the lockfile too).
2. Merge it.
3. On GitHub: **Actions → Package · release → Run workflow**, on `main`. Tick *Dry run* first if you want to see the checks and the package contents without publishing.

The [release workflow](.github/workflows/package-release.yml) reads the version from `package.json` on that commit and stops if tag `v<version>` already exists, if npm already has that version from another commit, or if `CHANGELOG.md` has no section for it. It then runs the tests, publishes to npm with provenance and, only after the publish succeeded, creates the tag `v<version>` on that commit and the GitHub release with the changelog section as notes. A version with a `-` (e.g. `0.2.0-rc.1`) publishes under the `next` dist-tag as a prerelease. If a run publishes but fails before the release, run it again on the same commit: it skips the publish and finishes the release.

Don't push `v*` tags by hand: the workflow creates them.

### One-time npm setup (maintainer)

1. Publish the first version by hand from a clean checkout of `main`: `npm login && npm publish`.
2. On npmjs.com → the package → *Settings* → *Trusted publishing*, add GitHub Actions with repository `benvdbergh/blueprint`, workflow `package-release.yml` and environment `npm`, and tick **npm publish** under *Allowed actions*. Entries created since September 2026 allow only `npm stage publish` by default, and a direct `npm publish` then fails with `403 OIDC permission denied for this action`. From then on the workflow publishes without a token.
3. (Alternative to 2) add an npm automation token as the `NPM_TOKEN` repository secret.
