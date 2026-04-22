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
  const writeManifest = () => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const files = readdirSync(dir)
      .filter((f) => extname(f).toLowerCase() === ".csv")
      .sort();
    const vehicles = files.map((fileName) => ({
      id: basename(fileName, extname(fileName)),
      fileName,
      url: `/vehicle_logs/${fileName}`,
    }));
    writeFileSync(
      resolve(dir, "index.json"),
      JSON.stringify({ vehicles }, null, 2) + "\n",
    );
  };
  return {
    name: "vehicle-manifest",
    buildStart() {
      writeManifest();
    },
    configureServer(server) {
      writeManifest();
      server.watcher.add(dir);
      const onChange = (file: string) => {
        if (file.startsWith(dir) && extname(file).toLowerCase() === ".csv") {
          writeManifest();
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    vehicleManifestPlugin(),
  ],
});
