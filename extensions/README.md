# extensions/

Each subfolder here is a standalone, publishable VS Code extension (its own `package.json` with the `vscode` engine field, `activationEvents`, `contributes`, etc.).

Create a new extension with the official (interactive) generator — there is no `@vscode/create-vscode` npm package:

```sh
npx --package yo --package generator-code -- yo code
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
