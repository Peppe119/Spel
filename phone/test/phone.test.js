import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { findHelp, getPlace, validate } from "../src/tools.js";
import { CallSession, SYSTEM_PROMPT } from "../src/agent.js";
import { LANGUAGES, LANG_CODES, WELCOME, langByKey } from "../src/languages.js";
import { voiceTwiml, callEndedTwiml, twilioSignature, server } from "../src/server.js";
import { genevaNow, T } from "../src/data.js";
import { fakeClient, toolUse, say } from "./fake-claude.js";

const MONDAY_10 = () => ({ d: 1, m: 10 * 60, label: "Monday 19 October 2026, 10:00" });
const ids = r => r.places.map(p => p.id);

function session(responses, opts = {}) {
  const sent = [];
  const client = fakeClient(responses);
  const s = new CallSession({ send: m => sent.push(m), client, now: MONDAY_10, ...opts });
  const spoken = () => sent.filter(m => m.type === "text").map(m => m.token).join("");
  return { s, sent, client, spoken };
}

test("find_help uses the same filters as the website", () => {
  const r = findHelp({ need: "meal", meal: "lunch", area: "servette", day: "monday", who: "woman" }, MONDAY_10());
  assert.ok(ids(r).includes("femmes"));
  assert.equal(r.searched_for.day, "monday");
  const shower = findHelp({ need: "shower", area: "servette", day: "today", who: "man", no_papers: true }, MONDAY_10());
  assert.deepEqual(ids(shower), ["pointdeau"]);
  assert.ok(shower.places[0].times.every(t => t.startsWith("monday")));
});

test("find_help: 'open now' and other days when nothing matches", () => {
  const now = findHelp({ need: "shower", open_now: true }, MONDAY_10());
  assert.ok(ids(now).includes("pointdeau"));
  assert.ok(now.places.every(p => p.open_now));
  const sunday = findHelp({ need: "shower", day: "sunday" }, MONDAY_10());
  assert.equal(sunday.total, 0);
  assert.ok(sunday.other_days.some(p => p.id === "pointdeau"));
});

test("find_help: postal code picks the right Colis du Cœur shop", () => {
  const r = findHelp({ need: "groceries", day: "any", postal_code: "1203" }, MONDAY_10());
  assert.deepEqual(ids(r), ["colis-charmilles"]);
  assert.ok(r.places[0].times.some(t => t.startsWith("wednesday")));
  assert.match(r.places[0].access, /certificate/);
});

test("get_place returns sources and the full week", () => {
  const p = getPlace({ id: "shelter" }, MONDAY_10());
  assert.equal(p.phone, "0800 22 22 10");
  assert.ok(p.dogs);
  assert.ok(p.sources.length >= 1);
});

test("tool input validation", () => {
  assert.equal(validate("find_help", { need: "meal" }), null);
  assert.match(validate("find_help", { need: "pizza" }), /need must be one of/);
  assert.match(validate("find_help", { open_now: "yes" }), /true or false/);
  assert.match(validate("get_place", {}), /missing id/);
  assert.match(validate("set_language", { language: "xx" }), /language must be one of/);
});

test("Geneva time is computed in Europe/Zurich", () => {
  const n = genevaNow(new Date("2026-10-22T22:30:00Z")); // 00:30 Friday in Geneva
  assert.equal(n.d, 5);
  assert.equal(n.m, 30);
});

test("12 languages, one keypad key each, matching the website", () => {
  assert.equal(LANG_CODES.length, 12);
  assert.deepEqual([...LANG_CODES].sort(), [...Object.keys(T)].sort());
  const keys = LANG_CODES.map(c => LANGUAGES[c].key);
  assert.equal(new Set(keys).size, 12);
  for (const c of LANG_CODES) {
    assert.equal(langByKey(LANGUAGES[c].key), c);
    for (const f of ["intro", "error", "refusal", "transfer", "locale", "name"]) assert.ok(LANGUAGES[c][f], `${c}.${f}`);
  }
  assert.match(WELCOME, /English, 2\./);
});

test("a call turn: searches, then speaks the answer in pieces", async () => {
  const t = session([
    toolUse("find_help", { need: "meal", meal: "lunch", area: "servette", day: "today", who: "woman" }),
    say("Femmes à Bord, avenue de Riant-Parc 23, sert le repas de midi aujourd'hui de 10h30 à 14h30."),
  ]);
  await t.s.handleUserText("Je suis une femme, je cherche à manger à midi vers la Servette");
  assert.match(t.spoken(), /Femmes à Bord/);
  assert.ok(t.sent.filter(m => m.type === "text").length > 3, "streams several tokens");
  assert.deepEqual(t.sent.at(-1), { type: "text", token: "", last: true });

  const first = t.client.calls[0];
  assert.equal(first.model, "claude-opus-5-5");
  assert.equal(first.fallbacks, "default");
  assert.deepEqual(first.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(first.system, SYSTEM_PROMPT);
  assert.ok(first.tools.every(tool => tool.eager_input_streaming));
  assert.match(first.messages[0].content[0].text, /Geneva time now: Monday.*Caller language: French \(fr\)/);

  const toolResult = t.client.calls[1].messages.at(-1).content[0];
  assert.equal(toolResult.type, "tool_result");
  assert.ok(JSON.parse(toolResult.content).places.some(p => p.id === "femmes"));
  assert.equal(t.s.messages.length, 4);
});

test("an invalid tool input is returned to Claude as an error, not run", async () => {
  const t = session([toolUse("find_help", { need: "pizza" }), say("Que cherchez-vous ?")]);
  await t.s.handleUserText("pizza");
  const result = t.client.calls[1].messages.at(-1).content[0];
  assert.equal(result.is_error, true);
});

test("keypad chooses a language and reads the intro", () => {
  const t = session([]);
  t.s.chooseLanguage(langByKey("2"));
  assert.deepEqual(t.sent[0], { type: "language", ttsLanguage: "en-GB", transcriptionLanguage: "en-GB" });
  assert.equal(t.sent[1].token, LANGUAGES.en.intro);
  assert.equal(t.s.lang, "en");
});

test("set_language from speech switches voice and recognition", async () => {
  const t = session([toolUse("set_language", { language: "uk" }), say("Добре, говоримо українською.")]);
  await t.s.handleUserText("Can you speak Ukrainian?");
  assert.ok(t.sent.some(m => m.type === "language" && m.ttsLanguage === "uk-UA"));
  assert.equal(t.s.lang, "uk");
});

test("transfer_call hands the call over after the last sentence", async () => {
  const t = session([toolUse("transfer_call", { target: "shelter_line" }), say("Je vous transfère.")]);
  await t.s.handleUserText("Oui, transférez-moi");
  const end = t.sent.at(-1);
  assert.equal(end.type, "end");
  assert.equal(JSON.parse(end.handoffData).reason, "transfer");
  assert.ok(t.s.ended);
  assert.match(callEndedTwiml(end.handoffData), /<Dial>\+41800222210<\/Dial>/);
  assert.match(callEndedTwiml(""), /<Hangup\/>/);
});

test("refusal and API errors: caller hears a fallback line, history stays valid", async () => {
  const t = session([{ stop_reason: "refusal", content: [] }, new Error("boom")], { lang: "es" });
  await t.s.handleUserText("x");
  assert.match(t.spoken(), /no puedo ayudar/);
  await t.s.handleUserText("y");
  assert.match(t.spoken(), /0800 22 22 10/);
  assert.equal(t.s.messages.length, 0);
});

test("caller interrupts: the stream stops and only what was heard is kept", async () => {
  const t = session([{ ...say("Il y a plusieurs endroits ouverts aujourd'hui."), hold: true }, say("D'accord.")]);
  const turn = t.s.handleUserText("Où manger ?");
  await new Promise(r => setTimeout(r, 5));
  t.s.interrupt("Il y a plusieurs");
  await turn;
  assert.deepEqual(t.s.messages.at(-1), { role: "assistant", content: "Il y a plusieurs" });
  const before = t.sent.length;
  await t.s.handleUserText("Une douche plutôt");
  assert.match(t.sent.slice(before).map(m => m.token).join(""), /D'accord/);
});

test("TwiML lists all 12 languages and escapes the greeting", () => {
  const x = voiceTwiml();
  assert.equal((x.match(/<Language /g) || []).length, 12);
  assert.match(x, /dtmfDetection="true"/);
  assert.match(x, /ligne d&apos;aide/);
  assert.match(x, /<Connect action="[^"]+\/call-ended">/);
});

test("Twilio signature check is deterministic", () => {
  const a = twilioSignature("secret", "https://x.ch/voice", { To: "+41", From: "+33", CallSid: "CA1" });
  const b = twilioSignature("secret", "https://x.ch/voice", { CallSid: "CA1", From: "+33", To: "+41" });
  assert.equal(a, b);
  assert.notEqual(a, twilioSignature("other", "https://x.ch/voice", { CallSid: "CA1", From: "+33", To: "+41" }));
});

test("server: /voice returns TwiML and the relay answers keypad presses", async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/voice`, { method: "POST", body: "CallSid=CA1&From=%2B41790000000" });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<ConversationRelay/);

    const ws = new WebSocket(`ws://localhost:${port}/relay`);
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
    const got = [];
    const two = new Promise(r => ws.on("message", m => { got.push(JSON.parse(m)); if (got.length === 2) r(); }));
    ws.send(JSON.stringify({ type: "setup", callSid: "CA1" }));
    ws.send(JSON.stringify({ type: "dtmf", digit: "#" }));
    await two;
    assert.equal(got[0].type, "language");
    assert.equal(got[0].ttsLanguage, "fa-IR");
    assert.equal(got[1].token, LANGUAGES.fa.intro);
    ws.close();
  } finally {
    await new Promise(r => server.close(r));
  }
});
