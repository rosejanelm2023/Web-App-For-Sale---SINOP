import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "client"), { recursive: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });

const css = (await readFile(resolve(root, "app/globals.css"), "utf8"))
  .replace('@import "tailwindcss";', "");

await writeFile(resolve(dist, "client/style.css"), css);
await cp(resolve(root, "static/index.html"), resolve(dist, "client/index.html"));
await cp(resolve(root, "static/app.js"), resolve(dist, "client/app.js"));
await cp(resolve(root, "static/supabase-client.js"), resolve(dist, "client/supabase-client.js"));
await cp(resolve(root, "static/supabase-integration.js"), resolve(dist, "client/supabase-integration.js"));
await cp(resolve(root, "public/favicon.svg"), resolve(dist, "client/favicon.svg"));
await cp(resolve(root, ".openai/hosting.json"), resolve(dist, ".openai/hosting.json"));

let envText = "";
try {
  envText = await readFile(resolve(root, ".env.local"), "utf8");
} catch {
  console.warn("No .env.local found. Building the agency edition without a connected Supabase project.");
}
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
await writeFile(
  resolve(dist, "client/config.js"),
  `window.__SUPABASE_CONFIG__=${JSON.stringify({ url: supabaseUrl || "", publishableKey: supabasePublishableKey || "" })};\n`,
);

await writeFile(
  resolve(dist, "server/index.js"),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
};
`,
);

console.log("Production build created in dist/");
