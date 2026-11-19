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

1. Open a PR that moves the `Unreleased` entries in `CHANGELOG.md` under a new version heading and bumps `version` in `package.json` (`npm version <patch|minor|major> --no-git-tag-version`).
2. Merge it.
3. Tag the merge commit: `git tag v0.2.0 && git push origin v0.2.0` (or *Draft a new release* on GitHub with a new tag).

The [release workflow](.github/workflows/package-release.yml) checks that the tag matches `package.json`, runs the tests, publishes to npm with provenance and creates the GitHub release with that version's changelog section. A tag with a `-` (e.g. `v0.2.0-rc.1`) publishes under the `next` dist-tag as a prerelease.

### One-time npm setup (maintainer)

1. Publish the first version by hand from a clean checkout of the tagged commit: `npm login && npm publish`.
2. On npmjs.com → the package → *Settings* → *Trusted publishing*, add GitHub Actions with repository `benvdbergh/blueprint`, workflow `package-release.yml` and environment `npm`, and tick **npm publish** under *Allowed actions*. Entries created since September 2026 allow only `npm stage publish` by default, and a direct `npm publish` then fails with `403 OIDC permission denied for this action`. From then on the workflow publishes without a token.
3. (Alternative to 2) add an npm automation token as the `NPM_TOKEN` repository secret.
