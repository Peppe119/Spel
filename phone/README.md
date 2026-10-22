# Geneva Help Line – ring och fråga

En telefonlinje där en AI-röst svarar på frågor om gratis hjälp i Genève: mat, dusch, tvätt, kläder, vård, nattlogi och rådgivning. Den som ringer behöver ingen smartphone, inget internet och behöver inte kunna läsa. Det räcker med en vanlig telefon, till exempel en lånad eller en på ett dagcenter.

Rösten använder samma 18 ställen och samma filterkod som webbsidan (`../js/`). Den ger alltså samma svar som sidan och hittar inte på egna öppettider.

## Så går ett samtal till

1. Den som ringer hör en hälsning på franska och engelska, och sedan en språkmeny.
2. Hen kan börja prata franska direkt, eller välja språk med knappsatsen:

   | Knapp | Språk | Knapp | Språk |
   | --- | --- | --- | --- |
   | 1 | Franska | 7 | Albanska |
   | 2 | Engelska | 8 | Turkiska |
   | 3 | Tyska | 9 | Ryska |
   | 4 | Italienska | 0 | Ukrainska |
   | 5 | Portugisiska | * | Arabiska |
   | 6 | Spanska | # | Persiska |

   Man kan också byta språk mitt i samtalet genom att be om det, till exempel "Can you speak English?".
3. Hen frågar med egna ord, till exempel "Var kan jag äta lunch idag nära Cornavin?" eller "Jag har ingenstans att sova i natt".
4. Boten söker i registret och svarar kort: namn, adress och när stället är öppet. Den säger också om stället kräver biljett eller remiss, eller bara tar emot kvinnor eller familjer.
5. Om någon behöver en säng i natt kan boten koppla samtalet vidare till stadens nattlogi-linje 0800 22 22 10. Vid fara eller akut sjukdom säger den åt personen att ringa 144 (ambulans) eller 117 (polis).

Boten frågar aldrig efter namn, papper eller uppehållsstatus. Telefonnummer maskeras i loggarna.

## Så fungerar tekniken

```
Telefon ──► Twilio-nummer ──► POST /voice (TwiML)
                                   │
            Twilio ConversationRelay (tal till text och text till tal, 12 språk)
                                   │  WebSocket /relay
                                   ▼
                          server.js → agent.js → Claude (claude-opus-5-5)
                                                   │ verktyg
                                                   ▼
                          tools.js: find_help, get_place, set_language, transfer_call
                                                   │
                                   ../js/data.js + ../js/search.js (samma som webbsidan)
```

- `src/server.js` tar emot samtalet, skickar TwiML och håller WebSocket-kopplingen mot Twilio.
- `src/agent.js` innehåller instruktionerna till Claude. Svaret strömmas ord för ord, så att rösten börjar prata direkt. Om den som ringer avbryter slutar rösten prata.
- `src/tools.js` innehåller de fyra verktygen som Claude får använda.
- `src/languages.js` innehåller de 12 språken, knapparna och de fasta fraserna, till exempel introt och felmeddelandet.

## Prova utan telefon

```sh
cd phone
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run chat
```

Skriv det som den som ringer skulle säga. En ensam siffra, `*` eller `#` fungerar som knappsatsen.

```sh
npm test    # 17 tester, körs utan nyckel och utan telefon
```

## Koppla in ett riktigt telefonnummer

1. **API-nyckel:** skapa en nyckel på console.anthropic.com.
2. **Twilio:** skapa ett konto på twilio.com och köp ett röstnummer.
   - Ett schweiziskt nummer kräver att ni registrerar en adress. För en demo går ett brittiskt eller amerikanskt nummer snabbare.
   - Ett gratisnummer (0800) kräver ett avtal. Testkontot läser upp ett meddelande först och kan bara ringa verifierade nummer.
   - Ni kan behöva godkänna villkoren för AI-funktioner i Twilio-konsolen innan ConversationRelay fungerar.
3. **Lägg upp servern på nätet.** Välj ett av sätten:
   - **Render:** New → Blueprint → välj det här repot. `render.yaml` finns i roten. Fyll i `ANTHROPIC_API_KEY`, `TWILIO_AUTH_TOKEN` och `PUBLIC_URL`, alltså tjänstens adress, till exempel `https://geneva-help-line.onrender.com`.
   - **Lokalt med ngrok:** kör `ngrok http 8080` och sedan `PUBLIC_URL=https://<din-adress>.ngrok-free.app TWILIO_AUTH_TOKEN=... ANTHROPIC_API_KEY=... npm start`.
4. **Twilio-numret:** gå till Phone Numbers → ditt nummer → Voice. Ställ in "A call comes in" på **Webhook**, `POST`, `https://<PUBLIC_URL>/voice`.
5. **Ring numret.**

### Inställningar

| Variabel | Betydelse |
| --- | --- |
| `ANTHROPIC_API_KEY` | Nyckeln till Claude (krävs) |
| `PUBLIC_URL` | Serverns offentliga https-adress (krävs för Twilio) |
| `TWILIO_AUTH_TOKEN` | Kontrollerar att anropen verkligen kommer från Twilio. Måste vara satt när servern är publik. |
| `MODEL` | Claude-modell, standard `claude-opus-5-5`. `claude-haiku-5-5` svarar snabbare och billigare. |
| `EFFORT` | `low` som standard, vilket ger snabba svar. |
| `SHELTER_LINE` | Numret man kopplas vidare till, standard `+41800222210`. |
| `TTS_PROVIDER`, `STT_PROVIDER` | Byter Twilios leverantör för talsyntes och taligenkänning, till exempel `Google` eller `ElevenLabs`. |

## Kontrollera innan ni går live

- **Språkkoderna** i `src/languages.js` måste finnas hos Twilios leverantörer för tal. Albanska (`sq-AL`), arabiska (`ar-SA`) och persiska (`fa-IR`) är märkta `verify: true`, eftersom stödet varierar mellan leverantörerna. Ring och tryck på deras knappar. Om rösten saknas, byt leverantör med `TTS_PROVIDER` eller ändra koden.
- **Vidarekopplingen** går till 0800 22 22 10. Fråga Ville de Genève om det går bra innan linjen används på riktigt.
- **Nödnummer** (144, 117, 112) går inte att koppla via Twilio, så boten säger bara åt personen att ringa dem.
- **Öppettiderna** kommer från `../js/data.js`. Uppdatera dem där, så ändras både webbsidan och telefonlinjen.
