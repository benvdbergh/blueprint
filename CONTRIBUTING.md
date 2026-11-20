# Contributing

Thanks for helping. This repository is two things at once:

- **The template**: `AGENTS.md`, `CLAUDE.md`, `blueprint/` (documents and `workflows/`), `.claude/commands/`, `.cursor/rules/`, `.github/copilot-instructions.md`. `cli/manifest.mjs` (`CORE`, `PROVIDERS`) lists what ends up in projects.
- **The installer** (`product-blueprint` on npm): `bin/`, `cli/`, `test/`. It copies the template into a project and upgrades it later.

The repository follows its own rules: read [`AGENTS.md`](AGENTS.md) first.

## Development

Requirements: Node ≥ 20 and git. There are no dependencies to install.

```bash
npm test                                          # installer tests (node:test); run before you open a PR
node bin/blueprint.mjs init /tmp/try --dry-run    # try the installer locally
```

- When you add a file to the template, add it to `cli/manifest.mjs` and decide how it behaves when the file already exists in a project (`managed`, `seed`, `block`, `json`).
- Workflow instructions (`blueprint/workflows/*.md`) are prompts for agents running unattended. Keep each one short and start it with **Run**, **Changes** and **Ends with**, then the goal, the steps, how to decide, and what to report. A test checks the headers.
- When you remove a file from the template, `upgrade` removes it from projects if they haven't edited it. Nothing else is needed.
- There is no CI on pull requests. Run `npm test` yourself; the release workflow runs it again before it publishes.
- `.github/workflows/package-release.yml` is the only GitHub Action here. It publishes the package and is never installed into projects.
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
