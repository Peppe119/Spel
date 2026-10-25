// Server för telefonlinjen.
//
//   POST /voice      Twilio anropar den här när någon ringer. Svarar med TwiML
//                    som kopplar samtalet till ConversationRelay (tal till text och text till tal).
//   WS   /relay      ConversationRelay skickar det ringaren säger hit och läser upp svaren.
//   POST /call-ended När samtalet är slut: lägger på.
//   GET  /health     Enkel hälsokontroll.
import http from "node:http";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { CallSession } from "./agent.js";
import { LANGUAGES, LANG_CODES, DEFAULT_LANG, WELCOME, langByKey } from "./languages.js";

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "";
const STT_PROVIDER = process.env.STT_PROVIDER || "";

const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const wsUrl = () => PUBLIC_URL.replace(/^http/, "ws") + "/relay";
const providers = () =>
  (TTS_PROVIDER ? ` ttsProvider="${xml(TTS_PROVIDER)}"` : "") + (STT_PROVIDER ? ` transcriptionProvider="${xml(STT_PROVIDER)}"` : "");

export function voiceTwiml() {
  const fr = LANGUAGES[DEFAULT_LANG];
  const langs = LANG_CODES.map(c => `      <Language code="${LANGUAGES[c].locale}"${providers()}/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="${xml(PUBLIC_URL)}/call-ended">
    <ConversationRelay url="${xml(wsUrl())}" language="${fr.locale}"${providers()} welcomeGreeting="${xml(WELCOME)}" welcomeGreetingInterruptible="any" interruptible="any" dtmfDetection="true">
${langs}
    </ConversationRelay>
  </Connect>
</Response>`;
}

export function callEndedTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Hangup/>\n</Response>`;
}

// Twilios signatur: base64(HMAC-SHA1(auth token, URL + sorterade POST-parametrar)).
export function twilioSignature(token, url, params = {}) {
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join("");
  return crypto.createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");
}

function validSignature(req, url, params) {
  if (!AUTH_TOKEN) return true; // lokalt test utan Twilio
  const got = req.headers["x-twilio-signature"];
  if (typeof got !== "string") return false;
  const want = twilioSignature(AUTH_TOKEN, url, params);
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function readForm(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error("body too large");
  }
  return Object.fromEntries(new URLSearchParams(body));
}

const mask = n => (n ? String(n).replace(/\d(?=\d{3})/g, "•") : "unknown");
const log = (...a) => console.log(new Date().toISOString(), ...a);

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, PUBLIC_URL).pathname;
  try {
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    if (req.method === "POST" && (path === "/voice" || path === "/call-ended")) {
      const params = await readForm(req);
      if (!validSignature(req, PUBLIC_URL + req.url, params)) {
        res.writeHead(403).end();
        return;
      }
      const body = path === "/voice" ? voiceTwiml() : callEndedTwiml();
      if (path === "/voice") log("incoming call", params.CallSid || "", "from", mask(params.From));
      res.writeHead(200, { "content-type": "text/xml" }).end(body);
      return;
    }
    res.writeHead(404).end();
  } catch (err) {
    log("http error", err.message);
    res.writeHead(500).end();
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url, PUBLIC_URL).pathname;
  if (path !== "/relay" || !validSignature(req, wsUrl() + req.url.slice("/relay".length), {})) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

wss.on("connection", ws => {
  let callSid = "";
  const session = new CallSession({
    send: msg => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)),
    log: (...a) => log(callSid, ...a),
  });

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case "setup":
        callSid = msg.callSid || "";
        log(callSid, "relay connected");
        break;
      case "prompt":
        log(callSid, `caller (${session.lang}):`, msg.voicePrompt);
        session.handleUserText(msg.voicePrompt).catch(err => log(callSid, "turn failed", err.message));
        break;
      case "dtmf": {
        const code = langByKey(msg.digit);
        if (code) {
          log(callSid, "language", code);
          session.chooseLanguage(code);
        }
        break;
      }
      case "interrupt":
        session.interrupt(msg.utteranceUntilInterrupt);
        break;
      case "error":
        log(callSid, "relay error", msg.description);
        break;
    }
  });
  ws.on("close", () => {
    session.stop();
    log(callSid, "call ended");
  });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    log(`Geneva Help Line listening on :${PORT}`);
    log(`Voice webhook: ${PUBLIC_URL}/voice   Relay: ${wsUrl()}`);
    if (!AUTH_TOKEN) log("TWILIO_AUTH_TOKEN not set: requests are not verified (fine for local tests only)");
  });
}

export { server };
