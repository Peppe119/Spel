/* Betasida för telefonlinjen: samma hjärna (js/helpline.js) som den riktiga linjen,
 * men man skriver istället för att prata och webbläsaren läser upp svaret.
 * Claude nås via sidans "sample"-förmåga; omdömen sparas i sidans databas ("db"). */
(() => {
const H = HELPLINE;
const $ = id => document.getElementById(id);
const RTL = ["ar", "fa"];
const RULES = H.SYSTEM_PROMPT +
  "\n\nThis is a beta test of the phone line in a web page. The caller types what they would say, " +
  "and the page reads your answer aloud. transfer_call is only simulated in this test.";

const EXAMPLES = [
  { lang: "fr", text: "Je cherche à manger à midi près de la gare Cornavin." },
  { lang: "en", text: "I slept outside last night and need a shower this morning." },
  { lang: "de", text: "Ich habe zwei kleine Kinder. Wo können wir heute zu Mittag essen?" },
  { lang: "es", text: "No tengo dónde dormir esta noche y tengo un perro." },
  { lang: "ar", text: "أنا امرأة وأحتاج ملابس دافئة. أين أذهب؟" },
  { lang: "uk", text: "У мене немає медичного страхування, а мені потрібен лікар." },
];

const st = { inCall: false, lang: H.DEFAULT_LANG, turns: [], busy: null, voice: true, transfer: false, started: 0 };
let sample = null, db = null, uid = null, mine = [], saving = Promise.resolve(), timerId = 0;

const use = name => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
// Hämta Claude direkt och för sig, så att en långsam databas aldrig håller tillbaka svaren.
const samplePromise = use("sample").then(s => (sample = s));
const langName = c => T[c].name;
const locale = () => H.LANGUAGES[st.lang].locale;

/* ---------- Röst ---------- */
let voices = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } };
try { loadVoices(); speechSynthesis.onvoiceschanged = () => { loadVoices(); voiceNote(); }; } catch { /* ingen talsyntes */ }
function voiceFor(loc) {
  const l = loc.toLowerCase(), base = l.split("-")[0];
  return voices.find(v => v.lang.toLowerCase().replace("_", "-") === l) ||
    voices.find(v => v.lang.toLowerCase().startsWith(base));
}
// Chrome tystnar på uppläsningar längre än cirka 15 sekunder och fastnar sedan,
// så texten läses mening för mening. Ljud som startas direkt efter cancel()
// kan tappas, så då väntar vi ett ögonblick.
let cancelledAt = 0, heardSound = false, soundCheck = 0;
function say(text, loc = locale()) {
  if (!st.voice || !("speechSynthesis" in window)) return;
  const clean = text.replace(/[*_#`>]/g, "").trim();
  if (!clean) return;
  const v = voiceFor(loc);
  const parts = clean.split(/(?<=[.!?؟…])\s+/).filter(Boolean);
  const speakAll = () => {
    try {
      speechSynthesis.resume();
      for (const part of parts) {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = loc;
        if (v) u.voice = v;
        u.onstart = () => { heardSound = true; };
        u.onerror = e => { if (!["interrupted", "canceled"].includes(e.error)) soundProblem(e.error); };
        speechSynthesis.speak(u);
      }
    } catch { soundProblem("blocked"); }
  };
  if (Date.now() - cancelledAt < 150) setTimeout(speakAll, 150);
  else speakAll();
  if (!heardSound) {
    clearTimeout(soundCheck);
    soundCheck = setTimeout(() => { if (st.voice && !heardSound) soundProblem("silent"); }, 4000);
  }
}
const hush = () => { cancelledAt = Date.now(); try { speechSynthesis.cancel(); } catch { /* tyst */ } };
let soundWarned = false;
function soundProblem(why) {
  if (soundWarned) return;
  soundWarned = true;
  sys(`No sound (${why}). Check that the volume is up and that your phone is not on silent. ` +
    "On iPhone, flip the silent switch off. If it still stays quiet, open the page on claude.ai in Chrome or Safari.");
}
function voiceNote() {
  const n = $("voicenote");
  if (!("speechSynthesis" in window)) n.textContent = "This browser cannot read aloud, so answers are shown as text.";
  else if (voices.length && !voiceFor(locale())) n.textContent = `This device has no ${H.LANGUAGES[st.lang].name} voice, so answers in ${langName(st.lang)} are shown as text only.`;
  else n.textContent = "Answers are read aloud with this device's voices.";
}

/* ---------- Skärmen ---------- */
function bubble(kind, text, lang) {
  $("idle")?.remove();
  const el = document.createElement("div");
  el.className = "msg " + kind;
  el.textContent = text;
  if (kind !== "sys") el.dir = "auto";
  if (lang) el.lang = lang;
  $("screen").append(el);
  el.scrollIntoView({ block: "end" });
  return el;
}
const sys = text => bubble("sys", text);

function setStatus(text, live) {
  $("status").textContent = text;
  $("bar").classList.toggle("live", !!live);
}
function tick() {
  const s = Math.floor((Date.now() - st.started) / 1000);
  $("timer").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function setLang(code) {
  st.lang = code;
  const q = $("q");
  q.placeholder = T[code].need;
  q.lang = code;
  q.dir = RTL.includes(code) ? "rtl" : "ltr";
  document.querySelectorAll("#keys button").forEach(b => b.classList.toggle("on", b.dataset.lang === code));
  voiceNote();
}

function renderKeys() {
  const order = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  $("keys").innerHTML = order.map(k => {
    const c = H.langByKey(k);
    return `<button type="button" data-key="${k}" data-lang="${c}" lang="${c}" disabled><b>${k}</b><span>${langName(c)}</span></button>`;
  }).join("");
}

function setEnabled(on) {
  ["q", "send", "hang"].forEach(id => { $(id).disabled = !on; });
  $("call").disabled = on;
  document.querySelectorAll("#keys button").forEach(b => { b.disabled = !on; });
}

/* ---------- Samtalet ---------- */
function startCall() {
  st.inCall = true;
  st.turns = [];
  st.started = Date.now();
  $("screen").replaceChildren();
  setEnabled(true);
  setLang(H.DEFAULT_LANG);
  setStatus("Connected", true);
  tick();
  timerId = setInterval(tick, 1000);
  bubble("bot", H.WELCOME, "fr");
  say(H.WELCOME, "fr-FR");
  $("q").focus();
}

function endCall(note = "Call ended") {
  st.busy?.abort();
  hush();
  st.inCall = false;
  clearInterval(timerId);
  setEnabled(false);
  setStatus(note, false);
  sys(note);
  $("q").placeholder = "Call first, then type here";
}

function pressKey(k) {
  if (!st.inCall) return;
  hush();
  const code = H.langByKey(k);
  if (!code) return;
  st.busy?.abort();
  setLang(code);
  sys(`Key ${k} → ${langName(code)}`);
  const intro = H.LANGUAGES[code].intro;
  bubble("bot", intro, code);
  st.turns.push({ role: "user", content: `(The caller pressed ${k} on the keypad and chose ${H.LANGUAGES[code].name}.)` });
  st.turns.push({ role: "assistant", content: intro });
  say(intro);
}

function pageTools(found, answerEl) {
  return H.TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
    execute(input) {
      const problem = H.validate(t.name, input);
      if (problem) throw new Error(problem);
      const now = H.genevaNow();
      switch (t.name) {
        case "find_help": {
          const r = H.findHelp(input, now);
          [...r.places, ...(r.other_days || [])].forEach(p => found.add(p.id));
          answerEl.before(Object.assign(document.createElement("div"), {
            className: "msg sys",
            textContent: "🔎 " + Object.entries(input).map(([k, v]) => `${k}: ${v}`).join(" · "),
          }));
          return r;
        }
        case "get_place":
          found.add(input.id);
          return H.getPlace(input, now);
        case "set_language":
          setLang(input.language);
          sys(`Language → ${langName(input.language)}`);
          return { ok: true, now_speaking: H.LANGUAGES[input.language].name };
        case "transfer_call":
          st.transfer = true;
          return { ok: true, info: "Simulated in this test. Tell the caller in one short sentence that you are transferring them to the shelter line." };
      }
    },
  }));
}

// Index i texten där sista hela meningen slutar, så att rösten kan börja läsa medan resten skrivs.
function sentenceEnd(text) {
  let end = 0;
  for (const m of text.matchAll(/[.!?؟…](?=\s)/g)) end = m.index + 1;
  return end;
}

const ERRORS = {
  not_granted: "Claude was not allowed for this page, so the line cannot answer. Reload the page to be asked again.",
  sampling_disabled: "Claude is not available on this account, so the line cannot answer.",
  tools_unavailable: "This Claude app cannot run the directory search. Open the page on claude.ai in a web browser.",
  rate_limited: "Too many questions at once. Wait a minute, then try again.",
  session_expired: "Sign in to Claude again, then try again.",
};

async function ask(text) {
  text = text.trim();
  if (!st.inCall || !text) return;
  if (!sample) {
    sys("Connecting to Claude…");
    await samplePromise;
    if (!sample) {
      sys("Claude is not available in this view, so the line cannot answer. Open the page on claude.ai in a web browser.");
      return;
    }
  }
  st.busy?.abort();
  hush();
  const ctl = new AbortController();
  st.busy = ctl;
  st.transfer = false;
  bubble("you", text, st.lang);
  const now = H.genevaNow();
  const L = H.LANGUAGES[st.lang];
  st.turns.push({ role: "user", content: `<call_context>Geneva time now: ${now.label}. Caller language: ${L.name} (${st.lang}).</call_context>\n${text}` });
  const out = bubble("bot", "Thinking… If Claude asks for permission, choose Allow.", "en");
  out.classList.add("thinking");
  const slow = setTimeout(() => { if (out.classList.contains("thinking")) out.textContent = "Still working… The first answer can take up to a minute."; }, 15000);
  const found = new Set();
  let spoken = 0;
  const speakNew = (all, final) => {
    const rest = all.slice(spoken);
    const piece = final ? rest : rest.slice(0, sentenceEnd(rest));
    spoken += piece.length;
    say(piece);
  };

  try {
    const { text: answer } = await sample([{ role: "user", content: RULES }, ...st.turns], {
      modelTier: "quick",
      signal: ctl.signal,
      tools: pageTools(found, out),
      onText: ({ text: so_far }) => {
        out.classList.remove("thinking");
        out.lang = st.lang;
        out.textContent = so_far;
        out.scrollIntoView({ block: "end" });
        speakNew(so_far, false);
      },
    });
    out.textContent = answer;
    speakNew(answer, true);
    st.turns.push({ role: "assistant", content: answer });
    rateControls(out, { question: text, answer, lang: st.lang, places: [...found] });
    if (st.transfer) endCall("Transferred to the shelter line (simulated)");
  } catch (e) {
    out.classList.remove("thinking");
    if (e.code === "cancelled") {
      if (e.text) { out.textContent = e.text; st.turns.push({ role: "assistant", content: e.text }); }
      else { out.remove(); st.turns.pop(); }
      return;
    }
    st.turns.pop();
    if (e.code === "refused") {
      out.textContent = L.refusal;
      say(L.refusal);
    } else if (ERRORS[e.code]) {
      out.remove();
      sys(ERRORS[e.code]);
    } else {
      out.textContent = (e.text ? e.text + "\n\n" : "") + L.error;
      say(L.error);
      sys(`Technical detail for the team: ${e.code || "unknown"}${e.message ? " – " + e.message : ""}`);
      console.error("sample failed", e);
    }
  } finally {
    clearTimeout(slow);
    if (st.busy === ctl) st.busy = null;
  }
}

/* ---------- Omdömen ---------- */
function rateControls(after, entry) {
  const box = document.createElement("div");
  box.className = "rate";
  box.innerHTML = `<span>Right place?</span><button type="button" data-v="good">👍 Yes</button><button type="button" data-v="bad">👎 No</button>`;
  after.after(box);
  box.addEventListener("click", async ev => {
    const b = ev.target.closest("button[data-v]");
    if (!b) return;
    box.querySelectorAll("button[data-v]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    if (b.dataset.v === "good") return save(box, { ...entry, verdict: "good", comment: "" });
    if (box.querySelector("textarea")) return;
    const ta = document.createElement("textarea");
    ta.placeholder = "What was wrong? (optional)";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "Save";
    ok.onclick = () => save(box, { ...entry, verdict: "bad", comment: ta.value.trim().slice(0, 500) });
    box.append(ta, ok);
    ta.focus();
  });
}

function save(box, entry) {
  const full = {
    ...entry,
    question: entry.question.slice(0, 500),
    answer: entry.answer.slice(0, 1500),
    at: new Date().toISOString(),
  };
  const note = box.querySelector(".saved") || box.appendChild(Object.assign(document.createElement("span"), { className: "saved" }));
  if (!db || !uid) {
    note.textContent = "Not saved: open the page in Claude, signed in, with Contributor access.";
    return;
  }
  note.textContent = "Saving…";
  saving = saving.then(async () => {
    const next = [...mine, full].slice(-100);
    try {
      await db.doc("feedback/" + uid).set({ entries: next, updatedAt: full.at });
      mine = next;
      note.textContent = "Saved. Thank you!";
      box.querySelectorAll("button, textarea").forEach(x => { x.disabled = true; });
      renderMine();
    } catch {
      note.textContent = "Not saved: ask the owner for Contributor access to this page.";
    }
  });
}

function renderMine() {
  const good = mine.filter(e => e.verdict === "good").length;
  $("mine").textContent = mine.length
    ? `You have rated ${mine.length} answer${mine.length === 1 ? "" : "s"}: ${good} right, ${mine.length - good} wrong. Thank you!`
    : "Rate answers on the phone and they are saved here for the team.";
}

async function loadResults() {
  if (!db) return;
  let snap;
  try { snap = await db.collection("feedback").get(); } catch { return; }
  const all = snap.docs.flatMap(d => (d.data()?.entries || []).map(e => ({ ...e, tester: d.id })));
  const good = all.filter(e => e.verdict === "good").length;
  const testers = new Set(all.map(e => e.tester)).size;
  const langs = new Set(all.map(e => e.lang)).size;
  const pct = all.length ? Math.round((good / all.length) * 100) + "%" : "–";
  $("stats").innerHTML = [[all.length, "answers rated"], [pct, "sent to the right place"], [testers, "testers"], [langs, "languages tried"]]
    .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
  const bad = all.filter(e => e.verdict === "bad").sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const fb = $("fb");
  fb.replaceChildren();
  if (!all.length) fb.append(Object.assign(document.createElement("p"), { className: "muted", textContent: "No ratings yet. Share the page with testers as Contributors." }));
  else if (!bad.length) fb.append(Object.assign(document.createElement("p"), { className: "muted", textContent: "No wrong answers reported so far." }));
  for (const e of bad.slice(0, 30)) {
    const a = document.createElement("article");
    const head = document.createElement("div");
    head.innerHTML = `<span class="pill bad">Wrong</span> `;
    head.append(`${langName(e.lang) || e.lang} · ${String(e.at).slice(0, 16).replace("T", " ")}`);
    const q = Object.assign(document.createElement("div"), { className: "q", textContent: e.question, dir: "auto" });
    const ans = Object.assign(document.createElement("div"), { className: "a", textContent: e.answer, dir: "auto" });
    a.append(head, q, ans);
    if (e.comment) a.append(Object.assign(document.createElement("div"), { textContent: "Tester: " + e.comment }));
    fb.append(a);
  }
}

/* ---------- Mikrofon (om webbläsaren tillåter den här) ---------- */
function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const btn = $("mic");
  btn.hidden = false;
  let rec = null;
  btn.onclick = () => {
    if (!st.inCall) return;
    if (rec) { rec.stop(); return; }
    hush();
    rec = new SR();
    rec.lang = locale();
    rec.interimResults = true;
    btn.setAttribute("aria-pressed", "true");
    rec.onresult = ev => {
      const r = [...ev.results].map(x => x[0].transcript).join(" ");
      $("q").value = r;
      if (ev.results[ev.results.length - 1].isFinal) { const v = $("q").value; $("q").value = ""; ask(v); }
    };
    rec.onerror = ev => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        btn.hidden = true;
        sys("The microphone is blocked on pages shown inside Claude. On a mobile, tap the microphone on your keyboard to speak instead of typing.");
      }
    };
    rec.onend = () => { rec = null; btn.setAttribute("aria-pressed", "false"); };
    try { rec.start(); } catch { rec = null; btn.hidden = true; }
  };
}

/* ---------- Start ---------- */
renderKeys();
$("checked").textContent = CHECKED;
$("examples").innerHTML = EXAMPLES.map((x, i) =>
  `<button type="button" data-ex="${i}"><small>${langName(x.lang)}</small><span lang="${x.lang}" dir="auto"></span></button>`).join("");
document.querySelectorAll("#examples button").forEach(b => { b.querySelector("span").textContent = EXAMPLES[b.dataset.ex].text; });

$("call").onclick = startCall;
$("hang").onclick = () => endCall();
$("keys").onclick = ev => { const b = ev.target.closest("button[data-key]"); if (b) pressKey(b.dataset.key); };
document.addEventListener("keydown", ev => {
  if (st.inCall && ev.target === document.body && /^[0-9*#]$/.test(ev.key)) pressKey(ev.key);
});
$("ask").onsubmit = ev => { ev.preventDefault(); const v = $("q").value; $("q").value = ""; ask(v); };
$("q").oninput = () => { if ($("q").value) hush(); };
$("voice").onclick = () => {
  st.voice = !st.voice;
  if (!st.voice) hush();
  $("voice").setAttribute("aria-pressed", String(st.voice));
  $("voice").textContent = st.voice ? "🔊 Voice on" : "🔇 Voice off";
};
$("examples").onclick = ev => {
  const b = ev.target.closest("button[data-ex]");
  if (!b) return;
  const ex = EXAMPLES[b.dataset.ex];
  if (!st.inCall) startCall();
  if (st.lang !== ex.lang) {
    hush();
    setLang(ex.lang);
    sys(`Key ${H.LANGUAGES[ex.lang].key} → ${langName(ex.lang)}`);
  }
  ask(ex.text);
};
$("reload").onclick = loadResults;
$("soundtest").onclick = () => {
  hush();
  soundWarned = false;
  const was = st.voice;
  st.voice = true;
  say("Bonjour. Hello. Sound works.", "fr-FR");
  st.voice = was;
};
setupMic();
voiceNote();

(async () => {
  await samplePromise;
  if (sample) {
    const lim = await sample.limits().catch(() => null);
    if (lim && !lim.tools) {
      $("notice").innerHTML = "<strong>Search unavailable here.</strong> This Claude app cannot run the directory search. Open the page on claude.ai in a web browser.";
      $("notice").hidden = false;
    }
  } else {
    $("notice").innerHTML = "<strong>Answers need Claude.</strong> Open this page on claude.ai to ask questions. The keypad, greeting and voice work here too.";
    $("notice").hidden = false;
  }
  const [d, u] = await Promise.all([use("db"), use("user")]);
  db = d;
  uid = (await u?.id?.().catch(() => null)) || null;
  if (db && uid) {
    try {
      const snap = await db.doc("feedback/" + uid).get();
      if (snap.exists) mine = snap.data().entries || [];
    } catch { /* inga tidigare omdömen */ }
    renderMine();
  }
  if (db && (await u?.isOwner?.().catch(() => false))) {
    $("results").hidden = false;
    loadResults();
  }
})();
})();
