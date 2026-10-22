// Prova telefonlinjen i terminalen utan telefon: skriv det ringaren säger.
// En ensam siffra 0-9, * eller # fungerar som knappsatsen (väljer språk).
// Kräver ANTHROPIC_API_KEY.   Kör: npm run chat
import readline from "node:readline/promises";
import { CallSession } from "./agent.js";
import { LANGUAGES, WELCOME, langByKey } from "./languages.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const session = new CallSession({
  send: msg => {
    if (msg.type === "text") process.stdout.write(msg.token + (msg.last ? "\n" : ""));
    else if (msg.type === "language") console.log(`\n[språk: ${msg.ttsLanguage}]`);
    else if (msg.type === "end") console.log("\n[samtalet kopplas vidare till 0800 22 22 10]");
  },
  log: (...a) => console.log("  ·", ...a.map(String)),
});

console.log("🔊", WELCOME, "\n");
for (;;) {
  const line = (await rl.question(`du (${session.lang}) > `)).trim();
  if (!line || line === "/quit") break;
  const code = langByKey(line);
  if (code) { console.log(`[knapp ${line} → ${LANGUAGES[code].name}]`); session.chooseLanguage(code); continue; }
  process.stdout.write("🔊 ");
  await session.handleUserText(line);
  if (session.ended) break;
}
rl.close();
