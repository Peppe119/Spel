// Ett samtal = en CallSession. Den skickar det som ringaren säger till Claude,
// kör verktygen och strömmar svaret tillbaka ord för ord så att Twilio kan läsa upp det.
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, validate, findHelp, getPlace } from "./tools.js";
import { LANGUAGES, DEFAULT_LANG } from "./languages.js";
import { genevaNow } from "./data.js";

export const MODEL = process.env.MODEL || "claude-opus-5-5";
// Låg effort ger snabbare svar, vilket betyder mest i ett telefonsamtal.
const EFFORT = process.env.EFFORT || "low";
const MAX_TOOL_ROUNDS = 6;

export const SYSTEM_PROMPT = `You are the voice of the Geneva Help Line, a free phone line for people in Geneva, Switzerland, who need food, a shower, clothes, medical care, a bed tonight or social advice. Many callers are homeless or newly arrived, under stress, and calling from a borrowed or public phone. Some cannot read.

This is a live phone call. Everything you write is read aloud by a text-to-speech voice, so write only what should be spoken:
- Answer in the caller's current language, given in the call context of each turn.
- Keep each answer to two to four short sentences. No lists, bullet points, symbols, emoji, markdown or web addresses.
- Name at most two or three places per answer: the name, the street and number, and when it is open. Then offer more options.
- Say times the natural spoken way for that language. Say phone numbers in small groups, for example 0800, 22, 22, 10.
- Place and street names are French. Say them as written.

Facts:
- Before a search you may say one very short phrase such as "One moment, I'm checking" in the caller's language, so the line is not silent.
- Call find_help before naming any place, time or address, and only give details the tools returned during this call. Never guess opening hours.
- "Today" and "now" mean the Geneva time in the call context. When the caller asks what is open now, use open_now.
- Always say when a place needs a ticket, a certificate from a social service, or is only for women or only for families. Everything in the directory is free.
- If nothing matches, say so and offer the other days the tool returned, or the shelter line.

Ask at most one short question at a time, only when you need it to search: what they need, which part of Geneva they are in, and whether the help is for a woman, a man or a family with children. If they do not know the area, search all of Geneva. Never ask for a name, documents, nationality or legal status.

Safety: if someone is in danger, badly hurt or very ill, tell them to hang up and call 144 for an ambulance or 117 for the police. If someone has nowhere to sleep tonight, give the free shelter line 0800 22 22 10 and offer to transfer the call with transfer_call. Only transfer when they say yes.

Language: the caller chose a language on the keypad or is speaking French. If they ask for another language, or clearly speak another supported language, call set_language and continue in that language. Supported languages: French, English, German, Italian, Portuguese, Spanish, Albanian, Turkish, Russian, Ukrainian, Arabic and Persian. If they speak a language that is not supported, answer briefly in English and French.

You cannot send text messages, book appointments or reserve places. Be warm, calm and respectful.`;

export class CallSession {
  /**
   * @param {object} opts
   * @param {(msg: object) => void} opts.send  sends a ConversationRelay message to Twilio
   * @param {Anthropic} [opts.client]
   * @param {() => {d:number,m:number,label:string}} [opts.now]
   */
  constructor({ send, client, lang = DEFAULT_LANG, now = genevaNow, log = () => {} }) {
    this.send = send;
    this._client = client;
    this.lang = lang;
    this.now = now;
    this.log = log;
    this.messages = [];
    this.turn = 0;
    this.stream = null;
    this.pendingTransfer = false;
    this.ended = false;
  }

  // Klienten skapas först när den behövs, så att knappsatsmenyn fungerar även utan nyckel.
  get client() {
    return (this._client ??= new Anthropic());
  }

  speak(text, last = true) {
    if (text) this.send({ type: "text", token: text, last });
    else if (last) this.send({ type: "text", token: "", last: true });
  }

  setLanguage(code) {
    if (!LANGUAGES[code]) return false;
    this.lang = code;
    const { locale } = LANGUAGES[code];
    this.send({ type: "language", ttsLanguage: locale, transcriptionLanguage: locale });
    return true;
  }

  // Knappsatsen: en siffra väljer språk och läser upp introt på det språket.
  chooseLanguage(code) {
    this.stop();
    if (!this.setLanguage(code)) return;
    this.speak(LANGUAGES[code].intro);
  }

  // Ringaren började prata medan rösten läste. Spara bara det som hann sägas.
  interrupt(heard) {
    const partial = this.stop();
    if (partial !== null) {
      const said = heard ?? partial;
      if (said) this.messages.push({ role: "assistant", content: said });
    }
  }

  // Avbryter pågående svar och returnerar texten som hunnit genereras, eller null.
  stop() {
    this.turn++;
    if (!this.stream) return null;
    const { stream, text } = this.stream;
    this.stream = null;
    stream.abort();
    return text;
  }

  async handleUserText(text) {
    if (this.ended) return;
    this.stop();
    const turn = this.turn;
    const lang = LANGUAGES[this.lang];
    const now = this.now();
    const base = this.messages.length;
    this.messages.push({
      role: "user",
      content: [
        { type: "text", text: `<call_context>Geneva time now: ${now.label}. Caller language: ${lang.name} (${this.lang}).</call_context>` },
        { type: "text", text: text || "(silence)" },
      ],
    });

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const message = await this.callClaude(turn);
        if (!message) return; // avbruten av ringaren

        if (message.stop_reason === "refusal") {
          // Rulla tillbaka hela turen så att historiken förblir giltig.
          this.messages.length = base;
          this.speak(LANGUAGES[this.lang].refusal);
          return;
        }
        const uses = message.content.filter(b => b.type === "tool_use");
        if (uses.length && message.stop_reason === "max_tokens") throw new Error("tool input truncated");
        this.messages.push({ role: "assistant", content: message.content });

        if (message.stop_reason !== "tool_use" || !uses.length) {
          this.speak("", true);
          if (this.pendingTransfer) this.transfer();
          return;
        }

        const results = uses.map(u => this.runTool(u, now));
        this.messages.push({ role: "user", content: results });
      }
      this.speak("", true);
    } catch (err) {
      if (turn !== this.turn) return;
      this.log("claude error", err);
      this.messages.length = base;
      this.speak(LANGUAGES[this.lang].error);
    }
  }

  async callClaude(turn) {
    const params = {
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: this.messages,
      output_config: { effort: EFFORT },
      cache_control: { type: "ephemeral" },
    };
    // Om Claude avböjer körs frågan om på en annan modell på serversidan (finns inte för Haiku).
    if (!MODEL.startsWith("claude-haiku")) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }
    const stream = this.client.beta.messages.stream(params);
    const state = { stream, text: "" };
    this.stream = state;
    stream.on("text", delta => {
      if (turn !== this.turn) return;
      state.text += delta;
      this.speak(delta, false);
    });
    try {
      const message = await stream.finalMessage();
      if (turn !== this.turn) return null;
      return message;
    } catch (err) {
      if (turn !== this.turn) return null;
      throw err;
    } finally {
      if (this.stream === state) this.stream = null;
    }
  }

  runTool(use, now) {
    const result = content => ({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(content) });
    const error = msg => ({ type: "tool_result", tool_use_id: use.id, is_error: true, content: msg });
    const problem = validate(use.name, use.input);
    if (problem) return error(problem);
    this.log("tool", use.name, JSON.stringify(use.input));
    switch (use.name) {
      case "find_help": return result(findHelp(use.input, now));
      case "get_place": return result(getPlace(use.input, now));
      case "set_language":
        this.setLanguage(use.input.language);
        return result({ ok: true, now_speaking: LANGUAGES[use.input.language].name });
      case "transfer_call":
        this.pendingTransfer = true;
        return result({ ok: true, info: "The call will be transferred to 0800 22 22 10 when you finish speaking. Say one short sentence telling the caller." });
    }
  }

  transfer() {
    this.ended = true;
    this.send({ type: "end", handoffData: JSON.stringify({ reason: "transfer", lang: this.lang }) });
  }
}
