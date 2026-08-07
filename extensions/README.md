# extensions/

Each subfolder here is a standalone, publishable VS Code extension (its own `package.json` with the `vscode` engine field, `activationEvents`, `contributes`, etc.).

Create a new extension with:

```sh
npm create @vscode/create-vscode -- --path extensions/<name>
```

Extension `tsconfig.json` files should extend the shared base config:

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
