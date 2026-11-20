// What `blueprint init` installs, and how each file is treated when it already exists.
//
// Strategies
//   managed  Files we keep up to date (the workflow instructions, Claude commands, the Cursor rule). Created when
//            missing. Updated on a re-run only if the file is unchanged since the last install (hash in the
//            install record). Otherwise it is a conflict: skipped, or written next to it as <file>.blueprint-new.
//   seed     Starting content the project is expected to edit (the blueprint documents). Created when
//            missing. Refreshed only while it is still exactly the template that was installed.
//   block    Instruction files an existing repo may already have (AGENTS.md, CLAUDE.md, ...). Created
//            when missing. If the file exists, our content is appended between markers and only that
//            block is replaced on later runs. The rest of the file is never changed.
//   json     JSON settings merged key by key (Gemini CLI).

// Everything a project gets: the shared instructions, the blueprint documents and the workflow instructions
// that agents follow on demand or as scheduled tasks. `only` limits a directory entry to matching paths.
export const CORE = [
  { path: "AGENTS.md", strategy: "block" },
  { path: "blueprint", strategy: "seed", only: /^blueprint\/[^/]+\.md$/ },
  { path: "blueprint/workflows", strategy: "managed" },
];

// Agent providers that need a file of their own on top of AGENTS.md.
// Only tools whose instruction-file convention is documented and in use today are listed. Tools that read
// AGENTS.md natively and need nothing else (OpenAI Codex, Copilot coding agent and CLI) are accepted as
// aliases so `--providers codex` doesn't fail, but install nothing extra.
export const PROVIDERS = {
  claude: {
    label: "Claude Code",
    why: "CLAUDE.md imports AGENTS.md, and /blueprint-sync, /blueprint-audit, … run the workflows. Claude Code reads AGENTS.md only when there is no CLAUDE.md.",
    files: [{ path: "CLAUDE.md", strategy: "block" }, { path: ".claude/commands", strategy: "managed" }],
    detect: ["CLAUDE.md", ".claude"],
  },
  cursor: {
    label: "Cursor",
    why: "Cursor reads AGENTS.md itself. This adds an always-apply rule with the short version of the rules.",
    files: [{ path: ".cursor/rules/blueprint.mdc", strategy: "managed" }],
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
    why: "Lovable takes instructions from its project Knowledge, not from a repo file. init prints the text to paste there.",
    files: [],
    detect: [],
    detectDependency: "lovable-tagger",
  },
};

export const AGENTS_MD_ONLY = {
  codex: "OpenAI Codex reads AGENTS.md directly",
};

export const DEFAULT_PROVIDERS = ["claude"];

export const RECORD_FILE = "blueprint/.install.json";
// Where versions before 0.3 kept the record.
export const LEGACY_RECORD_FILE = "governance/.blueprint-install.json";
export const SIDECAR_SUFFIX = ".blueprint-new";
export const BLOCK_START = "<!-- blueprint:start (managed by `blueprint init`; edits inside this block are replaced on upgrade) -->";
export const BLOCK_END = "<!-- blueprint:end -->";
