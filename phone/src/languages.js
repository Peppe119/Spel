// De 12 språken på telefonlinjen. Samma språk som på webbsidan.
//
// key:     siffran som väljer språket i knappsatsmenyn
// locale:  språkkod för taligenkänning och talsyntes hos Twilio.
//          Kontrollera mot Twilios lista över språk för ConversationRelay
//          innan ni går live, särskilt där verify är true.
// spoken:  hur språket sägs i den franska välkomstmenyn
export const LANGUAGES = {
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

export const DEFAULT_LANG = "fr";
export const LANG_CODES = Object.keys(LANGUAGES);
export const langByKey = key => LANG_CODES.find(c => LANGUAGES[c].key === key);

const KEY_WORD = { "*": "étoile", "#": "dièse" };

// Välkomsthälsningen läses på franska (Genèves språk) med en kort engelsk rad.
// Den som pratar franska kan börja prata direkt; andra väljer språk med knappsatsen.
export const WELCOME =
  "Bonjour, ici la ligne d'aide gratuite de Genève. Hello, this is the free Geneva help line. " +
  "Parlez en français, ou choisissez votre langue sur le clavier. " +
  LANG_CODES.map(c => `${LANGUAGES[c].spoken}, ${KEY_WORD[LANGUAGES[c].key] || LANGUAGES[c].key}.`).join(" ");
