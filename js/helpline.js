/* Telefonlinjens hjärna: språk, instruktioner och verktyg.
 * Delas av telefonservern (phone/) och betasidan (beta/), så att båda svarar likadant.
 * Kräver att data.js, i18n.js och search.js är inlästa först. */
const HELPLINE = (() => {
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Tid och veckodag i Genève, oavsett vilken tidszon servern kör i.
function genevaNow(date = new Date()) {
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

const SYSTEM_PROMPT = `You are the voice of the Geneva Help Line, a free phone line for people in Geneva, Switzerland, who need food, a shower, clothes, medical care, a bed tonight or social advice. Many callers are homeless or newly arrived, under stress, and calling from a borrowed or public phone. Some cannot read.

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

const LANGUAGES = {
  fr: { key: "1", locale: "fr-FR", name: "French", spoken: "Français",
    intro: "De quoi avez-vous besoin aujourd'hui ? Par exemple un repas, une douche, des vêtements, un médecin ou un lit pour ce soir.",
    error: "Désolé, j'ai un problème technique. Si vous cherchez un lit pour ce soir, appelez le 0800 22 22 10. Réessayez dans un moment.",
    refusal: "Désolé, je ne peux pas aider pour cela. Je peux vous aider à trouver à manger, une douche, des vêtements, des soins ou un lit à Genève.",
    transfer: "Je vous mets en relation avec la ligne d'hébergement d'urgence. Restez en ligne." },
  en: { key: "2", locale: "en-GB", name: "English", spoken: "English",
    intro: "What do you need today? For example a meal, a shower, clothes, a doctor or a bed for tonight.",
    error: "Sorry, I am having a technical problem. If you need a bed tonight, call 0800 22 22 10. Please try again in a moment.",
    refusal: "Sorry, I can't help with that. I can help you find food, showers, clothes, care or a bed in Geneva.",
    transfer: "I am connecting you to the emergency shelter line now. Please stay on the line." },
  de: { key: "3", locale: "de-DE", name: "German", spoken: "Deutsch",
    intro: "Was brauchen Sie heute? Zum Beispiel eine Mahlzeit, eine Dusche, Kleidung, einen Arzt oder ein Bett für heute Nacht.",
    error: "Entschuldigung, ich habe ein technisches Problem. Wenn Sie heute Nacht ein Bett brauchen, rufen Sie 0800 22 22 10 an. Bitte versuchen Sie es gleich noch einmal.",
    refusal: "Dabei kann ich leider nicht helfen. Ich helfe Ihnen, in Genf Essen, eine Dusche, Kleidung, medizinische Hilfe oder ein Bett zu finden.",
    transfer: "Ich verbinde Sie jetzt mit der Notunterkunft. Bitte bleiben Sie dran." },
  it: { key: "4", locale: "it-IT", name: "Italian", spoken: "Italiano",
    intro: "Di cosa hai bisogno oggi? Per esempio un pasto, una doccia, dei vestiti, un medico o un letto per stanotte.",
    error: "Scusa, ho un problema tecnico. Se ti serve un letto per stanotte, chiama lo 0800 22 22 10. Riprova tra poco.",
    refusal: "Mi dispiace, non posso aiutarti con questo. Posso aiutarti a trovare cibo, docce, vestiti, cure o un letto a Ginevra.",
    transfer: "Ti metto in contatto con la linea per l'alloggio d'emergenza. Resta in linea." },
  pt: { key: "5", locale: "pt-PT", name: "Portuguese", spoken: "Português",
    intro: "De que precisa hoje? Por exemplo, uma refeição, um duche, roupa, um médico ou uma cama para esta noite.",
    error: "Desculpe, estou com um problema técnico. Se precisa de uma cama para esta noite, ligue para o 0800 22 22 10. Tente novamente daqui a pouco.",
    refusal: "Desculpe, não posso ajudar com isso. Posso ajudar a encontrar comida, duches, roupa, cuidados de saúde ou uma cama em Genebra.",
    transfer: "Vou ligá-lo à linha de alojamento de emergência. Por favor, aguarde." },
  es: { key: "6", locale: "es-ES", name: "Spanish", spoken: "Español",
    intro: "¿Qué necesita hoy? Por ejemplo, una comida, una ducha, ropa, un médico o una cama para esta noche.",
    error: "Lo siento, tengo un problema técnico. Si necesita una cama para esta noche, llame al 0800 22 22 10. Inténtelo de nuevo en un momento.",
    refusal: "Lo siento, no puedo ayudar con eso. Puedo ayudarle a encontrar comida, duchas, ropa, atención médica o una cama en Ginebra.",
    transfer: "Le paso con la línea de alojamiento de urgencia. No cuelgue." },
  sq: { key: "7", locale: "sq-AL", name: "Albanian", spoken: "Shqip", verify: true,
    intro: "Çfarë ju nevojitet sot? Për shembull një vakt, një dush, rroba, një mjek ose një shtrat për sonte.",
    error: "Më vjen keq, kam një problem teknik. Nëse ju duhet një shtrat për sonte, telefononi 0800 22 22 10. Provoni përsëri pas pak.",
    refusal: "Më vjen keq, nuk mund të ndihmoj me këtë. Mund t'ju ndihmoj të gjeni ushqim, dush, rroba, kujdes shëndetësor ose një shtrat në Gjenevë.",
    transfer: "Po ju lidh me linjën e strehimit urgjent. Ju lutem prisni." },
  tr: { key: "8", locale: "tr-TR", name: "Turkish", spoken: "Türkçe",
    intro: "Bugün neye ihtiyacınız var? Örneğin yemek, duş, giysi, doktor ya da bu gece için bir yatak.",
    error: "Üzgünüm, teknik bir sorun var. Bu gece için yatağa ihtiyacınız varsa 0800 22 22 10'u arayın. Lütfen biraz sonra tekrar deneyin.",
    refusal: "Üzgünüm, bu konuda yardımcı olamam. Cenevre'de yemek, duş, giysi, sağlık hizmeti ya da yatak bulmanıza yardım edebilirim.",
    transfer: "Sizi acil barınma hattına bağlıyorum. Lütfen hatta kalın." },
  ru: { key: "9", locale: "ru-RU", name: "Russian", spoken: "Russkiy",
    intro: "Что вам нужно сегодня? Например, поесть, душ, одежда, врач или кровать на эту ночь.",
    error: "Извините, у меня техническая проблема. Если вам нужна кровать на эту ночь, позвоните 0800 22 22 10. Попробуйте ещё раз чуть позже.",
    refusal: "Извините, с этим я помочь не могу. Я помогу найти в Женеве еду, душ, одежду, медицинскую помощь или ночлег.",
    transfer: "Соединяю вас с линией экстренного жилья. Пожалуйста, не кладите трубку." },
  uk: { key: "0", locale: "uk-UA", name: "Ukrainian", spoken: "Oukraïnska",
    intro: "Що вам потрібно сьогодні? Наприклад, поїсти, душ, одяг, лікар або ліжко на цю ніч.",
    error: "Вибачте, у мене технічна проблема. Якщо вам потрібне ліжко на цю ніч, зателефонуйте 0800 22 22 10. Спробуйте ще раз трохи пізніше.",
    refusal: "Вибачте, з цим я допомогти не можу. Я допоможу знайти в Женеві їжу, душ, одяг, медичну допомогу або нічліг.",
    transfer: "З'єдную вас із лінією екстреного житла. Будь ласка, не кладіть слухавку." },
  ar: { key: "*", locale: "ar-SA", name: "Arabic", spoken: "Arabiya", verify: true,
    intro: "ماذا تحتاج اليوم؟ مثلاً وجبة، أو استحمام، أو ملابس، أو طبيب، أو سرير لهذه الليلة.",
    error: "عذراً، لدي مشكلة تقنية. إذا كنت تحتاج سريراً لهذه الليلة، اتصل على 0800 22 22 10. حاول مرة أخرى بعد قليل.",
    refusal: "عذراً، لا أستطيع المساعدة في ذلك. يمكنني مساعدتك في إيجاد طعام أو استحمام أو ملابس أو رعاية صحية أو سرير في جنيف.",
    transfer: "سأحوّلك الآن إلى خط الإيواء الطارئ. ابقَ على الخط من فضلك." },
  fa: { key: "#", locale: "fa-IR", name: "Persian", spoken: "Farsi", verify: true,
    intro: "امروز به چه چیزی نیاز دارید؟ مثلاً غذا، حمام، لباس، پزشک یا یک تخت برای امشب.",
    error: "متأسفم، یک مشکل فنی دارم. اگر امشب به جای خواب نیاز دارید، با 0800 22 22 10 تماس بگیرید. لطفاً کمی بعد دوباره امتحان کنید.",
    refusal: "متأسفم، در این مورد نمی‌توانم کمک کنم. می‌توانم به شما کمک کنم در ژنو غذا، حمام، لباس، مراقبت پزشکی یا جای خواب پیدا کنید.",
    transfer: "شما را به خط سرپناه اضطراری وصل می‌کنم. لطفاً گوشی را نگه دارید." },
};

const DEFAULT_LANG = "fr";
const LANG_CODES = Object.keys(LANGUAGES);
const langByKey = key => LANG_CODES.find(c => LANGUAGES[c].key === key);

const KEY_WORD = { "*": "étoile", "#": "dièse" };

// Välkomsthälsningen läses på franska (Genèves språk) med en kort engelsk rad.
// Den som pratar franska kan börja prata direkt; andra väljer språk med knappsatsen.
const WELCOME =
  "Bonjour, ici la ligne d'aide gratuite de Genève. Hello, this is the free Geneva help line. " +
  "Parlez en français, ou choisissez votre langue sur le clavier. " +
  LANG_CODES.map(c => `${LANGUAGES[c].spoken}, ${KEY_WORD[LANGUAGES[c].key] || LANGUAGES[c].key}.`).join(" ");

const EN = T.en;
const WHO = ["any", "woman", "man", "family"];
const DAYS = ["today", "tomorrow", "any", ...DAY_NAMES];
const MAX_RESULTS = 6;

const TOOLS = [
  {
    name: "find_help",
    description:
      "Search the Geneva directory of free help (meals, groceries, showers, laundry, clothes, health care, " +
      "emergency shelter, social advice). Always call this before naming a place, a time or an address. " +
      "Returns matching places with address, opening times on the requested day, access rules and notes. " +
      "If nothing matches the day or 'open now', it also returns options on other days.",
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
    input_schema: {
      type: "object",
      properties: { target: { type: "string", enum: ["shelter_line"] } },
      required: ["target"],
      additionalProperties: false,
    },
  },
];

// Inputs stream eagerly, so the API does not validate them: check them here.
function validate(name, input) {
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

function findHelp(input, now = genevaNow()) {
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

function getPlace({ id }, now = genevaNow()) {
  const s = S.find(x => x.id === id);
  const r = s.sch ? { s, slots: s.sch } : { s, slots: [], unknown: true };
  return {
    ...place(r, now, null),
    ...(s.link ? { website: s.link } : {}),
    sources: s.src.map(k => `${SRC[k].name} (${SRC[k].date})`),
    checked: CHECKED,
  };
}

return { LANGUAGES, LANG_CODES, DEFAULT_LANG, WELCOME, langByKey, SYSTEM_PROMPT, TOOLS, validate, findHelp, getPlace, DAY_NAMES, genevaNow };
})();
