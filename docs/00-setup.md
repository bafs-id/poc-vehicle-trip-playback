# 00 — Project scaffold

## Goal

Get an empty, compilable Vite + React + TS project on disk with all the runtime/dev dependencies, configs, and entry HTML the rest of the guide assumes.

## Steps

### 1. Scaffold

```bash
npm create vite@latest poc-vehicle-route -- --template react-ts
cd poc-vehicle-route
```

### 2. Install runtime dependencies

```bash
npm install leaflet@^1.9.4 react-leaflet@^5.0.0 papaparse@^5.5.3 zustand@^5.0.12
```

> `react` and `react-dom` are already in the template at ^19. If your template installed an older version, upgrade with `npm install react@^19.2.5 react-dom@^19.2.5`.

### 3. Install dev dependencies

```bash
npm install -D \
  @types/leaflet@^1.9.21 @types/papaparse@^5.5.2 @types/node@^24.12.2 \
  @rolldown/plugin-babel@^0.2.3 @babel/core@^7.29.0 \
  babel-plugin-react-compiler@^1.0.0 @types/babel__core@^7.20.5
```

### 4. Replace generated configs

Open the freshly-scaffolded project and overwrite the four config files plus `index.html` with the contents below.

#### `package.json` (top-level keys you care about)

Make sure your `scripts` and `type` blocks match:

```json
{
  "name": "poc-vehicle-route",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

#### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
```

#### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

#### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

#### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

#### `eslint.config.js`

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
```

#### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>poc-vehicle-route</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5. Clear the template's `src/`

Delete everything inside `src/` (and the `src/assets/` folder) — you'll recreate `main.tsx`, `App.tsx`, `App.css`, and `index.css` from scratch in the next phases.

```bash
rm -rf src/* src/.gitignore 2>/dev/null
```

> Re-create `src/` if `rm -rf` removed it: `mkdir src`.

## Walk-through

- **Why `@rolldown/plugin-babel`?** React Compiler ships as a Babel plugin. Vite 8's official React plugin runs SWC, not Babel — so we add a parallel Babel pass via the Rolldown-compatible plugin to apply `babel-plugin-react-compiler`. `reactCompilerPreset()` is a helper exported by `@vitejs/plugin-react` that returns the preset config the compiler expects.
- **Why two `tsconfig`s?** `tsconfig.app.json` covers your **runtime** code (DOM + Vite client types). `tsconfig.node.json` covers the **build-time** files like `vite.config.ts` (Node types, no DOM). The root `tsconfig.json` is just a project-references stitching file so `tsc -b` builds both.
- **`verbatimModuleSyntax: true`** means TypeScript will not silently rewrite imports. **Every type-only import must use `import type`** — get used to typing it.
- **`erasableSyntaxOnly: true`** forbids TypeScript-only constructs that aren't pure type erasure (e.g. enums, namespaces). The codebase uses plain `type` aliases and `as const` only.

## Pitfalls

> **Vite version + Node version.** Vite 8 requires Node 20.19+ or 22+. If `npm run dev` errors on startup with a Node-version message, upgrade Node before debugging anything else.

> **`favicon.svg` 404.** `index.html` references `/favicon.svg`; the Vite template ships a different favicon. Either drop a `public/favicon.svg` of your own, or remove the `<link rel="icon">` line — the 404 is harmless but noisy.

## Checkpoint

```bash
npm run dev
```

You should see Vite print a localhost URL. Opening it shows a blank page (you've deleted the demo). The dev server should start with **no errors**. Press `Ctrl+C` to stop.

```bash
npx tsc --noEmit
```

Should also exit cleanly (no source files yet → nothing to type-check).

➡️ Continue to [01-styles-and-types.md](01-styles-and-types.md).
