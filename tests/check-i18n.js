// Kontrollerar att alla språk har exakt samma nycklar som engelskan.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js/i18n.js"), "utf8");
const ctx = vm.createContext({});
vm.runInContext(src + "\n;globalThis.__out={T,LANGS};", ctx);
const { T, LANGS } = ctx.__out;

const keys = (o, pre = "") => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === "object" && !Array.isArray(v) ? keys(v, pre + k + ".") : [pre + k]);
const ref = new Set(keys(T.en));
let bad = 0;
for (const l of LANGS) {
  const have = new Set(keys(T[l]));
  const missing = [...ref].filter(k => !have.has(k));
  const extra = [...have].filter(k => !ref.has(k));
  const arrays = ["tabs", "days", "daysL"].filter(k => T[l][k].length !== T.en[k].length);
  if (missing.length || extra.length || arrays.length) {
    bad++;
    console.log(`✗ ${l}: saknas ${missing.join(", ") || "-"} · extra ${extra.join(", ") || "-"} · fel längd ${arrays.join(", ") || "-"}`);
  } else console.log(`✓ ${l} (${T[l].name})`);
}
console.log(`\n${LANGS.length - bad}/${LANGS.length} språk kompletta`);
process.exit(bad ? 1 : 0);
