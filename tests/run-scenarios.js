// Kör de 10 testscenarierna i Node mot samma filterkod som sidan använder.
// Användning: node tests/run-scenarios.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const files = ["js/data.js", "js/search.js", "js/scenarios.js"];
const src = files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n");
const ctx = vm.createContext({});
vm.runInContext(src + "\n;globalThis.__out={S,TESTS,base,search};", ctx);
const { S, TESTS, base, search } = ctx.__out;

let pass = 0;
TESTS.forEach((tc, i) => {
  const ids = search({ ...base, ...tc.f }).map(r => r.s.id);
  const ok = tc.exp.some(e => ids.includes(e));
  if (ok) pass++;
  const names = tc.exp.map(id => S.find(s => s.id === id).name).join(" / ");
  console.log(`${ok ? "✓" : "✗"} ${i + 1}. [${tc.lang}] ${tc.p}\n    förväntat: ${names} · fick: ${ids.join(", ") || "—"}`);
});
console.log(`\n${pass}/${TESTS.length} rätt hänvisningar`);
process.exit(pass === TESTS.length ? 0 : 1);
