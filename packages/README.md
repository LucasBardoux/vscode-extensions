# packages/

Shared, internal libraries consumed by one or more extensions in [extensions/](../extensions) (e.g. shared utilities, UI components, config presets). Not published to the VS Code Marketplace.

Each package should have its own `package.json` and a `tsconfig.json` extending the shared base config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```
