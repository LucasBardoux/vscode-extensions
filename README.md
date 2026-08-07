# vscode-extensions

TypeScript monorepo for developing VS Code extensions.

## Structure

```
.
├── extensions/   # publishable VS Code extensions (one per subfolder)
├── packages/     # shared internal libraries used by extensions
├── tsconfig.base.json   # shared TypeScript compiler options
└── .prettierrc.json      # shared formatting rules
```

## Requirements

- Node.js >= 22
- npm >= 11

## Getting started

```sh
npm install
npm run build
```

## Scripts

| Script                 | Description                                |
| ---------------------- | ------------------------------------------ |
| `npm run build`        | Build all workspaces                       |
| `npm run watch`        | Watch-build all workspaces                 |
| `npm run typecheck`    | Type-check the whole repo via project refs |
| `npm run format`       | Format the whole repo with Prettier        |
| `npm run format:check` | Check formatting without writing           |
| `npm run test`         | Run tests in all workspaces                |

> Note: `npm run typecheck` errors until at least one project is added to the root `tsconfig.json` `references` array — `tsc --build` requires a non-empty solution.

## Adding a new extension

```sh
npm create @vscode/create-vscode -- --path extensions/<name>
```

Then add its path to the root `tsconfig.json` `references` array and have its own `tsconfig.json` extend `tsconfig.base.json` (see [extensions/README.md](extensions/README.md)).
