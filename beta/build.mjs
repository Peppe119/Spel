// Bygger Claude-versionen av betan till en enda fil: index.html med CSS,
// webbsidans data, telefonlinjens hjärna (js/helpline.js) och beta.js inbakade.
// I Claude skrivs frågorna; röstversionen är index.html som vanlig webbsida.
// Kör: node beta/build.mjs [utfil]   (standard: beta/dist/helpline-beta.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, "dist/helpline-beta.html"));
const read = f => fs.readFileSync(path.resolve(here, f), "utf8");

const page = read("index.html");
const between = (a, b) => page.slice(page.indexOf(a) + a.length, page.indexOf(b));
const head = between("<head>", "</head>").split("\n")
  .filter(l => /<title>|claude:viewport|fonts\.googleapis/.test(l)).join("\n");
const body = between("<!-- PAGE -->", "<!-- /PAGE -->");
const scripts = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map(m => `/* ---- ${m[1]} ---- */\n` + read(m[1])).join("\n");
if (scripts.includes("</script")) throw new Error("a script contains </script");

const html = `${head}\n<style>\n${read("beta.css")}</style>\n${body}\n<script>\n${scripts}\n</script>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(process.cwd(), out)} (${Math.round(html.length / 1024)} KB)`);
