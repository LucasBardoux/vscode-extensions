# AGENTS.md

Guidelines for all contributions in this monorepo — for humans and AI agents alike. When speed and these rules conflict, the rules win.

## Language

All code, identifiers, comments, commit messages, and documentation are written in **English**, regardless of the language used in chat/conversation with an agent or reviewer.

## Working efficiently (AI agents)

These rules exist to cut wasted tokens, not to cut corners — verification, tests, and quality bars elsewhere in this file still apply in full.

- Don't re-read a file immediately after `Edit`/`Write` "to verify" — the tool already confirms success. Only re-read it if a later step genuinely needs its current content.
- Prefer targeted reads over whole-file reads: grep for the symbol/section you need, or read a specific line range, instead of dumping an entire file when only part of it is relevant.
- After the first full build, use incremental `tsc --build` (no `--force`) — only force a full rebuild when the incremental cache is actually suspected stale (e.g. after deleting `dist/` by hand).
- When checking whether a command passed, prefer a summarized signal (exit code, or grepping for the one result line, e.g. `^# (tests|pass|fail)` for `node --test`) over pasting full verbose command output into context.
- Batch a logically complete change and verify it once, instead of rebuild → test → package → reinstall after every micro-edit.
- Run typecheck/tests for the whole workspace in as few commands as possible rather than once per package, unless isolating a failure requires it.
- No filler in responses to the user: state what changed and why; skip restating the obvious, narrating exploration that didn't lead anywhere, or repeating context the user already has.
- Comments cost tokens on every future read of a file, not just once — keep following the no-unnecessary-comments rule from the Core principle below strictly.

## Core principle

Always follow best practices: Clean Code, DRY, SOLID where it makes sense (not dogmatically). Small, focused modules and functions instead of large files with many responsibilities. No dead code, no unused exports, no commented-out code blocks committed. TypeScript `strict` stays on ([tsconfig.base.json](tsconfig.base.json)) — only use `any` when there is truly no better option, and add a comment explaining why.

## Architecture: `extensions/` vs. `packages/`

- **`extensions/<name>`** contains only the wiring to the VS Code API: commands, providers, activation, webviews, reading/writing configuration, status bar, etc. Keep it as thin as possible.
- **`packages/<name>`** contains everything that works independently of `vscode`: pure logic, data models, parsers, services, utilities.
- Rule of thumb: can a function be tested without importing `vscode`? Then it belongs in `packages/`, not in `extensions/`.
- Before adding new logic to an extension, check whether a suitable package already exists — prefer extending an existing package over duplicating logic.
- Wrap VS-Code-specific side effects (API calls) in `extensions/` behind small interfaces/adapters, so the underlying logic in `packages/` stays testable without an extension host.
- Each package has a single public entry point (`src/index.ts`) that exports its public API. Other packages/extensions only import through it, never from internal files. No circular dependencies between packages.

## Tests

- Unit tests run on the native Node.js test runner (`node:test` + `node:assert/strict`) — no additional test framework dependency (no Jest, Vitest, Mocha, Chai, ...).
- Tests are co-located next to the code as `*.test.ts` (e.g. `src/foo.ts` + `src/foo.test.ts`), no separate `__tests__` folder duplicating the structure.
- Each package/extension has its own `"test"` script (`node --test`), so `npm run test --workspaces --if-present` at the root picks everything up.
- `packages/` should have significantly higher test coverage than `extensions/`, since that's where the actual logic lives.

## More points for a good developer experience

- **Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`) — makes changelogs easier and keeps history searchable.
- **Versioning:** once more than one extension exists, use [Changesets](https://github.com/changesets/changesets) for independent versioning/release notes per extension instead of versioning everything in lockstep.
- **CHANGELOG.md:** every extension needs one (Marketplace convention, shown in the "Changelog" tab).
- **package.json hygiene:** every extension correctly declares `publisher`, `engines.vscode`, `categories`, `repository`, `icon` — otherwise `vsce package`/publish fails or the listing looks unfinished.
- **No secrets in the repo:** Marketplace/OVSX tokens etc. only via environment variables or CI secrets, never committed.
- **CI before every merge:** at minimum `tsc --build` (typecheck), `prettier --check` (format), and `npm test` must pass.
- **Webviews:** strict Content Security Policy, no inline script without a nonce, no unsanitized HTML strings built from user input.
- **Root workspace conventions:** always run `npm install` at the root (never inside a single package/extension) so workspace linking stays intact. Create new packages via `npm init -w extensions/<name>` or `npm init -w packages/<name>`.

## Current stack context (as of initial setup)

- TypeScript 7 (the native compiler) is used deliberately, even though `typescript-eslint` doesn't support it yet (peer range `<6.1.0`). That's why there is currently **no ESLint** in the repo — code quality is enforced via `tsc --build` (type errors) and Prettier (formatting). If `typescript-eslint` adds TS7 support, or a downgrade to TS 5.9 is preferred, ESLint can be re-added.
- The root `tsconfig.json` is a pure solution file (`references`) — every package/extension gets its own `tsconfig.json` extending `tsconfig.base.json`, registered as a reference at the root.
