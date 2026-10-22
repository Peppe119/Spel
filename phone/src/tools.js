// Verktygen som AI-rösten får använda. find_help och get_place kör samma
// filterkod som webbsidan; set_language och transfer_call styr samtalet.
import { S, SRC, CHECKED, AREAS, AREAN, NEEDS, MEALK, T, search, toMin, DAY_NAMES, genevaNow } from "./data.js";
import { LANG_CODES } from "./languages.js";

const EN = T.en;
const WHO = ["any", "woman", "man", "family"];
const DAYS = ["today", "tomorrow", "any", ...DAY_NAMES];
const MAX_RESULTS = 6;

export const TOOLS = [
  {
    name: "find_help",
    description:
      "Search the Geneva directory of free help (meals, groceries, showers, laundry, clothes, health care, " +
      "emergency shelter, social advice). Always call this before naming a place, a time or an address. " +
      "Returns matching places with address, opening times on the requested day, access rules and notes. " +
      "If nothing matches the day or 'open now', it also returns options on other days.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        need: { type: "string", enum: NEEDS, description: "What the caller needs. 'meal' covers breakfast, lunch, dinner and soup. 'sleep' is the emergency shelter line." },
        meal: { type: "string", enum: ["any", ...MEALK], description: "Only when need is 'meal'. 'snack' means hot drink or soup." },
        area: { type: "string", enum: AREAS, description: "Part of Geneva. " + AREAS.filter(a => a !== "any").map(a => `${a} = ${AREAN[a]}`).join("; ") + ". Use 'any' if the caller does not know." },
        day: { type: "string", enum: DAYS, description: "Which day. Default 'today'." },
        open_now: { type: "boolean", description: "Only places open at this moment." },
        who: { type: "string", enum: WHO, description: "Who the help is for. Women-only and family-only places depend on this." },
        no_papers: { type: "boolean", description: "True if the caller cannot bring a referral or certificate from a social service." },
        postal_code: { type: "string", description: "Swiss postal code, e.g. 1203. Only matters for free groceries (Colis du Cœur)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_place",
    description: "Full weekly schedule, address, rules and source for one place, by the id returned from find_help.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { id: { type: "string", enum: S.map(s => s.id) } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "set_language",
    description:
      "Switch the language the caller hears and the language the speech recognition listens for. " +
      "Call it when the caller asks for another language or clearly speaks another supported language. " +
      "After calling it, answer in the new language.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { language: { type: "string", enum: LANG_CODES } },
      required: ["language"],
      additionalProperties: false,
    },
  },
  {
    name: "transfer_call",
    description:
      "Transfer this call to Geneva's free emergency shelter line (0800 22 22 10, Ville de Genève) " +
      "for someone who needs a bed tonight and agrees to be transferred. The call is handed over after your current sentence.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { target: { type: "string", enum: ["shelter_line"] } },
      required: ["target"],
      additionalProperties: false,
    },
  },
];

// Inputs stream eagerly, so the API does not validate them: check them here.
export function validate(name, input) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return `unknown tool ${name}`;
  if (!input || typeof input !== "object" || Array.isArray(input)) return "input must be an object";
  const { properties, required = [] } = tool.input_schema;
  for (const k of required) if (!(k in input)) return `missing ${k}`;
  for (const [k, v] of Object.entries(input)) {
    const p = properties[k];
    if (!p) return `unknown field ${k}`;
    if (p.type === "boolean" && typeof v !== "boolean") return `${k} must be true or false`;
    if (p.type === "string" && typeof v !== "string") return `${k} must be a string`;
    if (p.enum && !p.enum.includes(v)) return `${k} must be one of ${p.enum.join(", ")}`;
  }
  return null;
}

const access = s => ({
  walkin: "free, just walk in",
  ticket: "free, but take a free meal ticket on site first",
  referral: "free, but needs a certificate or voucher from a social service",
  phone: "free, call first",
}[s.access]);

const audience = s => ({ all: "everyone", women: "women only", families: "families with children only" }[s.aud]);

function slotText(e, days) {
  const parts = [`${days.map(d => DAY_NAMES[d]).join(", ")} ${e.t[0]}-${e.t[1]}: ${EN.k[e.k].toLowerCase()}`];
  if (e.x) parts.push(`(${e.x})`);
  if (e.w) parts.push("- women only");
  if (e.n) parts.push(`- ${EN.n[e.n]}`);
  if (e.pc) parts.push(e.pc === "other" ? "- for postal codes not listed at the other ColiShops" : `- for postal codes ${e.pc.join(", ")}`);
  return parts.join(" ");
}

function openNow(s, now) {
  return !!s.sch && s.sch.some(e => !e.n && e.d.includes(now.d) && now.m >= toMin(e.t[0]) && now.m < toMin(e.t[1]));
}

function place(r, now, dayFilter) {
  const s = r.s;
  const slots = r.unknown ? ["opening hours not published; ask the social service for the voucher"]
    : r.slots.map(e => slotText(e, dayFilter === null ? e.d : e.d.filter(d => d === dayFilter)));
  return {
    id: s.id,
    name: s.name,
    ...(s.org ? { organisation: s.org } : {}),
    area: s.area === "all" ? "whole canton, by phone" : AREAN[s.area],
    ...(s.addr ? { address: s.addr } : {}),
    ...(s.phone ? { phone: s.phone } : {}),
    access: access(s),
    for_whom: audience(s),
    ...(s.dogs ? { dogs: "dogs can be accepted under conditions" } : {}),
    open_now: openNow(s, now),
    times: slots,
    notes: s.notes.map(n => EN.n[n]),
  };
}

function resolveDay(day, now) {
  if (!day || day === "today") return now.d;
  if (day === "tomorrow") return (now.d + 1) % 7;
  if (day === "any") return null;
  return DAY_NAMES.indexOf(day);
}

export function findHelp(input, now = genevaNow()) {
  const day = input.open_now ? now.d : resolveDay(input.day, now);
  const f = {
    need: input.need || "any",
    meal: input.need === "meal" ? input.meal || "any" : "any",
    area: input.area || "any",
    day: day === null ? "any" : String(day),
    open: !!input.open_now,
    who: input.who || "any",
    walk: !!input.no_papers,
    pc: input.postal_code ? String(input.postal_code).replace(/\D/g, "") : "",
  };
  const hits = search(f, now);
  const out = {
    searched_for: { ...input, day: day === null ? "any day" : DAY_NAMES[day] },
    total: hits.length,
    places: hits.slice(0, MAX_RESULTS).map(r => place(r, now, day)),
  };
  if (!hits.length && (day !== null || f.open)) {
    const other = search({ ...f, day: "any", open: false }, now);
    out.note = "Nothing matches that day or time. These match on other days:";
    out.other_days = other.slice(0, MAX_RESULTS).map(r => place(r, now, null));
  }
  if (!out.total && !out.other_days?.length) {
    out.note = "Nothing in the directory matches. Offer the free emergency line 0800 22 22 10 (shelter) or 144 for medical emergencies.";
  }
  return out;
}

export function getPlace({ id }, now = genevaNow()) {
  const s = S.find(x => x.id === id);
  const r = s.sch ? { s, slots: s.sch } : { s, slots: [], unknown: true };
  return {
    ...place(r, now, null),
    ...(s.link ? { website: s.link } : {}),
    sources: s.src.map(k => `${SRC[k].name} (${SRC[k].date})`),
    checked: CHECKED,
  };
}
