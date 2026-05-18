import * as esbuild from "esbuild";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Packages node_modules qui ne doivent pas être bundled
const externalPackages = [
  "@simplewebauthn/server",
  "bcryptjs",
  "cookie-parser",
  "cors",
  "drizzle-orm",
  "express",
  "multer",
  "openai",
  "pdf-parse",
  "pdfkit",
  "pino",
  "pino-http",
  "web-push",
  "xlsx",
  "zod",
  "ws",
  "@trpc/server",
  "superjson",
  "pg",
  "drizzle-zod",
];

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/index.mjs",
  external: externalPackages,
  sourcemap: true,
  minify: false,
  treeShaking: true,
  logLevel: "info",
  resolveExtensions: [".ts", ".js", ".mjs"],
});

console.log("Build complete: dist/index.mjs");
