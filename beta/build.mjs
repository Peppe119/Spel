// Bygger betasidan till en enda HTML-fil: beta.html med webbsidans data,
// telefonlinjens hjärna (js/helpline.js) och beta.js inbakade.
// Kör: node beta/build.mjs [utfil]   (standard: beta/dist/helpline-beta.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.resolve(process.argv[2] || path.join(here, "dist/helpline-beta.html"));

const scripts = ["js/data.js", "js/i18n.js", "js/search.js", "js/helpline.js", "beta/beta.js"]
  .map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(root, f), "utf8"))
  .join("\n");
if (scripts.includes("</script")) throw new Error("a script contains </script");

const html = fs.readFileSync(path.join(here, "beta.html"), "utf8")
  .replace("<!-- SCRIPTS -->", `<script>\n${scripts}\n</script>`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(process.cwd(), out)} (${Math.round(html.length / 1024)} KB)`);
