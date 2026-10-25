// Telefonserverns version av samtalet: samma CallSession som röstbetan,
// med hjärnan från js/helpline.js och en Anthropic-klient för Node.
import Anthropic from "@anthropic-ai/sdk";
import { CallSession as BaseSession } from "./call-session.js";
import { TOOLS_SCHEMA, validate, findHelp, getPlace, LANGUAGES, DEFAULT_LANG, SYSTEM_PROMPT, genevaNow } from "./data.js";

export { SYSTEM_PROMPT };

export const MODEL = process.env.MODEL || "claude-opus-5-5";
// Låg effort ger snabbare svar, vilket betyder mest i ett telefonsamtal.
const EFFORT = process.env.EFFORT || "low";

export const BRAIN = { TOOLS: TOOLS_SCHEMA, validate, findHelp, getPlace, LANGUAGES, DEFAULT_LANG, SYSTEM_PROMPT, genevaNow };

export class CallSession extends BaseSession {
  constructor(opts) {
    super({ brain: BRAIN, model: MODEL, effort: EFFORT, makeClient: () => new Anthropic(), ...opts });
  }
}
