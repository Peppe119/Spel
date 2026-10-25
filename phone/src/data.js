// Laddar webbsidans data och filterkod (js/data.js, js/i18n.js, js/search.js) och
// telefonlinjens gemensamma hjärna (js/helpline.js), så att telefonlinjen, betasidan
// och webbsidan alltid svarar med samma uppgifter.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = ["js/data.js", "js/i18n.js", "js/search.js", "js/helpline.js"];
const src = files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n");
const ctx = vm.createContext({});
vm.runInContext(
  src + "\n;globalThis.__out={S,SRC,CHECKED,AREAS,AREAN,NEEDS,MEALK,T,LANGS,search,toMin,needOf,HELPLINE};",
  ctx,
);

const raw = ctx.__out;
// structuredClone gör om datan till vanliga objekt i den här Node-miljön.
export const { CHECKED, T, toMin, needOf } = raw;
export const [S, SRC, AREAS, AREAN, NEEDS, MEALK, LANGS] =
  structuredClone([raw.S, raw.SRC, raw.AREAS, raw.AREAN, raw.NEEDS, raw.MEALK, raw.LANGS]);
export const search = (f, now) => structuredClone(raw.search(f, now));

const H = raw.HELPLINE;
export const { LANGUAGES, LANG_CODES, DEFAULT_LANG, WELCOME, SYSTEM_PROMPT, DAY_NAMES, langByKey, validate } = H;
export const TOOLS_SCHEMA = structuredClone(H.TOOLS);
export const genevaNow = date => structuredClone(H.genevaNow(date));
export const findHelp = (input, now = genevaNow()) => structuredClone(H.findHelp(input, now));
export const getPlace = (input, now = genevaNow()) => structuredClone(H.getPlace(input, now));
