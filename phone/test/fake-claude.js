// En låtsas-Claude för testerna: spelar upp förinspelade svar i ordning.
export function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(structuredClone(params));
          const next = responses.shift();
          const handlers = [];
          let aborted = false;
          let resolveHold;
          return {
            on(ev, fn) { if (ev === "text") handlers.push(fn); return this; },
            abort() { aborted = true; resolveHold?.(); },
            async finalMessage() {
              await Promise.resolve();
              if (next instanceof Error) throw next;
              const content = next.content ?? [];
              for (const b of content) {
                if (b.type !== "text") continue;
                for (const word of b.text.split(/(?<= )/)) {
                  if (aborted) break;
                  handlers.forEach(h => h(word));
                  await Promise.resolve();
                }
              }
              if (next.hold) await new Promise(r => { resolveHold = r; });
              if (aborted) throw new Error("Request was aborted.");
              return { role: "assistant", stop_reason: next.stop_reason ?? "end_turn", content };
            },
          };
        },
      },
    },
  };
}

export const toolUse = (name, input, id = "tu_" + name) => ({
  stop_reason: "tool_use",
  content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "tool_use", id, name, input }],
});
export const say = text => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });
