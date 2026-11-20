// What `blueprint init` installs, and how each file is treated when it already exists.
//
// Strategies
//   managed  Governance machinery (workflows, actions, issue forms; with --vendor also the CLI copy). Created when missing. Updated on a
//            re-run only if the file is unchanged since the last install (hash in the install record).
//            Otherwise it is a conflict: skipped, or written next to it as <file>.blueprint-new.
//   seed     Starting content the project is expected to edit (blueprint docs, config, CODEOWNERS).
//            Created when missing, never touched again.
//   block    Instruction files an existing repo may already have (AGENTS.md, CLAUDE.md, ...). Created
//            when missing. If the file exists, our content is appended between markers and only that
//            block is replaced on later runs. The rest of the file is never changed.
//   json     JSON settings merged key by key (Gemini CLI).
//   lines    Line lists merged by appending missing lines (.gitignore).

// What lands in the project. Since 0.3 the project keeps only what it owns or what GitHub and the agent
// tools need to find in the repository: AGENTS.md (+ provider files), the blueprint documents,
// governance/config.json, the CI workflows and GitHub templates. The checks, starters and workflow specs
// stay in the package and are run with `npx product-blueprint@<version> <command>` (see bin/blueprint.mjs).
//
// `only` limits a directory entry to matching package paths.
export const CORE = [
  { path: "AGENTS.md", strategy: "block" },
  { path: ".github/pull_request_template.md", strategy: "block" },
  { path: ".github/CODEOWNERS", strategy: "seed" },
  { path: ".github/ISSUE_TEMPLATE", strategy: "managed" },
  { path: ".github/actions", strategy: "managed" },
  { path: ".github/workflows", strategy: "managed" },
  { path: "blueprint", strategy: "seed", only: /^blueprint\/[^/]+\.md$/ },
  { path: "governance/config.json", strategy: "seed" },
  { path: "cli/gitignore.txt", target: ".gitignore", strategy: "lines" },
];

// `--vendor`: a copy of the CLI and everything it serves, under VENDOR_DIR, for CI without npm access or
// teams that want to read and pin every line in their own repository. The workflows find it there
// (.github/actions/setup-blueprint) and the instruction files call `node .blueprint/bin/blueprint.mjs`.
export const VENDOR_DIR = ".blueprint";
export const VENDOR = [
  { path: "bin", strategy: "managed" },
  { path: "cli", strategy: "managed" },
  { path: "scripts", strategy: "managed" },
  { path: "templates", strategy: "managed" },
  { path: "governance/README.md", strategy: "managed" },
  { path: "governance/health-report-template.md", strategy: "managed" },
  { path: "governance/workflows", strategy: "managed" },
  { path: "governance/agents", strategy: "managed" },
  { path: "blueprint", strategy: "managed", only: /^blueprint\/[^/]+\/(_TEMPLATE|README)\.md$/ },
  { path: "contracts/README.md", strategy: "managed" },
  { path: ".claude/commands", strategy: "managed" },
  { path: "package.json", strategy: "managed" },
];

// The versioned CLI call that instruction files, workflow specs and prompts use. `init` stamps the
// installed version into it, and `--vendor` replaces it with the vendored copy.
export const CLI_PATTERN = /npx (?:--yes )?product-blueprint@\d+\.\d+\.\d+(?:-[\w.]+)?/g;
export const cliCommand = (version) => `npx product-blueprint@${version}`;
export const VENDOR_CLI = `node ${VENDOR_DIR}/bin/blueprint.mjs`;

// Files that are only ever *read* by the package (served by `blueprint docs`, `prompt` and `new`).
// Listed here so the version stamp and tests cover them.
export const SERVED = [
  "governance/README.md", "governance/health-report-template.md", "governance/workflows", "governance/agents",
  "blueprint/features/_TEMPLATE.md", "blueprint/decisions/_TEMPLATE.md", "blueprint/deviations/_TEMPLATE.md",
  "blueprint/prototypes/README.md", "blueprint/README.md", "contracts/README.md", "templates", ".claude/commands",
];

// This repository's own CI for the installer. It lives next to the payload workflows but is never installed.
export const EXCLUDE = [/^\.github\/workflows\/package-[^/]+\.yml$/];

// Agent providers that need a file of their own on top of AGENTS.md.
// Only tools whose instruction-file convention is documented and in use today are listed. Tools that read
// AGENTS.md natively and need nothing else (OpenAI Codex, Copilot coding agent and CLI) are accepted as
// aliases so `--providers codex` doesn't fail, but install nothing extra.
export const PROVIDERS = {
  claude: {
    label: "Claude Code",
    why: "CLAUDE.md imports AGENTS.md. Claude Code reads AGENTS.md only when there is no CLAUDE.md, and only from v2.1.277 (later on Bedrock and Vertex).",
    // .claude/commands: the AI workflows as slash commands. CI reads the same files through `blueprint prompt`,
    // which prefers the project's copy, so local and CI behaviour match.
    files: [{ path: "CLAUDE.md", strategy: "block" }, { path: ".claude/commands", strategy: "managed" }],
    detect: ["CLAUDE.md", ".claude"],
  },
  cursor: {
    label: "Cursor",
    why: "Cursor reads AGENTS.md itself. This adds an always-apply rule with the short version of the rules.",
    files: [{ path: ".cursor/rules/governance.mdc", strategy: "managed" }],
    detect: [".cursor", ".cursorrules"],
  },
  copilot: {
    label: "GitHub Copilot",
    why: "Copilot's coding agent, CLI and VS Code chat read AGENTS.md, but github.com chat and code review only read .github/copilot-instructions.md.",
    files: [{ path: ".github/copilot-instructions.md", strategy: "block" }],
    detect: [".github/copilot-instructions.md", ".github/instructions"],
  },
  gemini: {
    label: "Gemini CLI",
    why: "Gemini CLI reads GEMINI.md by default. This points its context.fileName at AGENTS.md (and keeps GEMINI.md).",
    files: [{ path: ".gemini/settings.json", strategy: "json", content: { context: { fileName: ["AGENTS.md", "GEMINI.md"] } } }],
    detect: ["GEMINI.md", ".gemini"],
  },
  lovable: {
    label: "Lovable",
    why: "Lovable takes instructions from its project Knowledge, not from a repo file. `blueprint docs lovable` prints the text to paste there.",
    files: [],
    detect: [],
    detectDependency: "lovable-tagger",
  },
};

export const AGENTS_MD_ONLY = {
  codex: "OpenAI Codex reads AGENTS.md directly",
};

export const DEFAULT_PROVIDERS = ["claude"];

export const RECORD_FILE = "governance/.blueprint-install.json";
export const SIDECAR_SUFFIX = ".blueprint-new";
export const BLOCK_START = "<!-- blueprint:start (managed by `blueprint init`; edits inside this block are replaced on upgrade) -->";
export const BLOCK_END = "<!-- blueprint:end -->";
