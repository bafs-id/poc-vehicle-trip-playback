import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";

/**
 * Scan public/vehicle_logs/ for *.csv and write index.json so the browser
 * can discover the available vehicles at runtime. Files in public/ aren't
 * processed by Vite, so we materialize a manifest at dev/build start.
 */
function vehicleManifestPlugin(): Plugin {
  const dir = resolve(__dirname, "public/vehicle_logs");
  let base = "/";
  const buildManifest = () => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const files = readdirSync(dir)
      .filter((f) => extname(f).toLowerCase() === ".csv")
      .sort();
    const vehicles = files.map((fileName) => ({
      id: basename(fileName, extname(fileName)),
      fileName,
      url: `${base}vehicle_logs/${fileName}`,
    }));
    return { vehicles };
  };
  const writeManifest = () => {
    writeFileSync(
      resolve(dir, "index.json"),
      JSON.stringify(buildManifest(), null, 2) + "\n",
    );
  };
  return {
    name: "vehicle-manifest",
    configResolved(config) {
      base = config.base;
    },
    buildStart() {
      writeManifest();
    },
    configureServer(server) {
      // Vite 8's dev server serves `public/**/*.json` via the SPA HTML
      // fallback instead of the static file, so a plain <base>/vehicle_logs/
      // index.json request returns index.html and JSON.parse blows up.
      // Serve the manifest from a middleware so the dev flow doesn't depend
      // on static-file handling.
      const manifestPath = `${base}vehicle_logs/index.json`;
      server.middlewares.use(manifestPath, (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(buildManifest(), null, 2) + "\n");
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/poc/vehicle-trip-placback/",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    vehicleManifestPlugin(),
  ],
});
