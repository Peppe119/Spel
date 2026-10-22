// Laddar webbsidans data och filterkod (js/data.js, js/i18n.js, js/search.js)
// så att telefonlinjen och sidan alltid svarar med samma uppgifter.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = ["js/data.js", "js/i18n.js", "js/search.js"];
const src = files.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n");
const ctx = vm.createContext({});
vm.runInContext(
  src + "\n;globalThis.__out={S,SRC,CHECKED,AREAS,AREAN,NEEDS,MEALK,T,LANGS,search,toMin,needOf};",
  ctx,
);

const raw = ctx.__out;
// structuredClone gör om datan till vanliga objekt i den här Node-miljön.
export const { CHECKED, T, toMin, needOf } = raw;
export const [S, SRC, AREAS, AREAN, NEEDS, MEALK, LANGS] =
  structuredClone([raw.S, raw.SRC, raw.AREAS, raw.AREAN, raw.NEEDS, raw.MEALK, raw.LANGS]);
export const search = (f, now) => structuredClone(raw.search(f, now));

export const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Tid och veckodag i Genève, oavsett vilken tidszon servern kör i.
export function genevaNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map(p => [p.type, p.value]),
  );
  const d = DAY_NAMES.indexOf(parts.weekday.toLowerCase());
  const m = Number(parts.hour) * 60 + Number(parts.minute);
  return { d, m, label: `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}` };
}
