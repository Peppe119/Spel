// Ett samtal = en CallSession. Den skickar det som ringaren säger till Claude,
// kör verktygen och strömmar svaret tillbaka ord för ord så att det kan läsas upp.
//
// Filen har inga importer, så att samma samtalslogik kan köras både av
// telefonservern (agent.js, i Node) och av röstbetan i webbläsaren (beta/).
// Allt den behöver skickas in: Claude-klienten och "hjärnan" från js/helpline.js.
const MAX_TOOL_ROUNDS = 6;

export class CallSession {
  /**
   * @param {object} opts
   * @param {(msg: object) => void} opts.send  tar emot {type:"text"|"language", ...}
   * @param {object} opts.brain  TOOLS, validate, findHelp, getPlace, LANGUAGES, DEFAULT_LANG, SYSTEM_PROMPT, genevaNow
   * @param {object} [opts.client]  en Anthropic-klient
   * @param {() => object} [opts.makeClient]  skapar klienten första gången den behövs
   */
  constructor({ send, brain, client, makeClient, model = "claude-opus-5-5", effort = "low", system,
    lang, now, log = () => {} }) {
    this.send = send;
    this.brain = brain;
    this._client = client;
    this.makeClient = makeClient;
    this.model = model;
    this.effort = effort;
    this.system = system ?? brain.SYSTEM_PROMPT;
    this.lang = lang ?? brain.DEFAULT_LANG;
    this.now = now ?? (() => brain.genevaNow());
    this.log = log;
    this.messages = [];
    this.turn = 0;
    this.stream = null;
  }

  // Klienten skapas först när den behövs, så att knappsatsmenyn fungerar även utan nyckel.
  get client() {
    return (this._client ??= this.makeClient());
  }

  speak(text, last = true) {
    if (text) this.send({ type: "text", token: text, last });
    else if (last) this.send({ type: "text", token: "", last: true });
  }

  setLanguage(code) {
    const L = this.brain.LANGUAGES[code];
    if (!L) return false;
    this.lang = code;
    this.send({ type: "language", ttsLanguage: L.locale, transcriptionLanguage: L.locale });
    return true;
  }

  // Knappsatsen: en siffra väljer språk och läser upp introt på det språket.
  chooseLanguage(code) {
    this.stop();
    if (!this.setLanguage(code)) return;
    this.speak(this.brain.LANGUAGES[code].intro);
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
    this.stop();
    const turn = this.turn;
    const { LANGUAGES } = this.brain;
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
      model: this.model,
      max_tokens: 4000,
      system: this.system,
      tools: this.brain.TOOLS.map(t => ({ ...t, eager_input_streaming: true })),
      messages: this.messages,
      output_config: { effort: this.effort },
      cache_control: { type: "ephemeral" },
    };
    // Om Claude avböjer körs frågan om på en annan modell på serversidan (finns inte för Haiku).
    if (!this.model.startsWith("claude-haiku")) {
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

  // Verktygsinput strömmas direkt (eager_input_streaming), så API:t validerar den inte.
  // validate() kontrollerar den innan verktyget körs.
  runTool(use, now) {
    const { validate, findHelp, getPlace, LANGUAGES } = this.brain;
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
    }
  }
}
