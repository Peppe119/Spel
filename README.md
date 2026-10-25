# Geneva Help Finder

En flerspråkig hjälpguide för Genève, gjord för ett hackathon. Den visar gratis mat, dusch, tvätt, kläder, vård, matkassar och nattlogi. Sidan har 18 riktiga ställen hämtade från stadens officiella lista (juli 2026) och från Colis du Cœurs egen sida. Varje kort visar sin källa och datum.

## Telefonlinje

Många som behöver hjälpen har ingen smartphone. Därför finns också en telefonlinje i `phone/`. Man ringer ett nummer och en AI-röst svarar på frågor på alla 12 språk, med samma data som webbsidan. Läs mer i [`phone/README.md`](phone/README.md).

## Beta: testa telefonlinjen i webbläsaren

I `beta/` finns en testversion av telefonlinjen som körs i Claude. Man ringer upp, väljer språk på knappsatsen, skriver sin fråga och hör svaret uppläst. Testarna betygsätter varje svar, och ägaren ser allas resultat. Betan använder samma hjärna (`js/helpline.js`) som den riktiga telefonlinjen. Bygg den med `node beta/build.mjs`.

## Kör

Sidan är ren HTML, CSS och JS och behöver inte byggas. Öppna `index.html` direkt, eller starta en lokal server:

```sh
npm start          # http://localhost:8000
npm test           # kontrollerar alla språk och kör de 10 testscenarierna (Node)
```

## Som app i mobilen

Sidan är en installerbar webbapp (PWA). Den öppnas i helskärm med egen ikon och fungerar utan internet när den har öppnats en gång.

- **Android och Chrome:** tryck på knappen **⤓ Installera** högst upp, eller välj "Installera app" i webbläsarens meny.
- **iPhone:** öppna sidan i Safari, tryck på Dela och välj "Lägg till på hemskärmen".

Appen måste ligga på en https-adress för att kunna installeras. Med det inbyggda GitHub Pages-flödet (`.github/workflows/pages.yml`) gör ni så här:

1. Gå till repots **Settings → Pages** och välj **Source: GitHub Actions**.
2. Merga koden till `main`. Appen publiceras då automatiskt på `https://<användare>.github.io/Spel/`.

När data eller kod ändras ska ni höja `VERSION` i `sw.js`, så att alla som har installerat appen får den nya versionen.

## Funktioner

- **12 språk:** franska, engelska, tyska, italienska, portugisiska, spanska, albanska, turkiska, ryska, ukrainska, arabiska och persiska. Arabiska och persiska läses från höger till vänster. Sidan väljer webbläsarens språk automatiskt.
- **Filter:**
  - typ av hjälp (måltid, matkasse, dusch, tvätt, kläder, vård, nattlogi, rådgivning)
  - vilken måltid
  - område
  - dag
  - öppet just nu
  - målgrupp (kvinna, man, familj med barn)
  - inga papper eller remiss
  - postnummer, som avgör vilken dag man får matkasse hos Colis du Cœur
- **Märkning på korten:** gratis, gå bara in (drop-in), gratis biljett på plats, remiss krävs, endast kvinnor och endast familjer.
- **Fliken 5 Whys:** huvudkedjan och fyra rötter, kopplade till funktionerna.
- **Fliken 10 testscenarier:** kör samma filterkod som sidan och räknar ut poängen (10/10).
- **Fliken Källor och metod:** visar källorna och vad som medvetet är utelämnat.

## Medvetet utelämnat

Rullstolsanpassning, halal och vegetariskt, ID-krav, närhet till kollektivtrafik och hemleverans går inte att filtrera på. Källorna säger inget om dem, så sådana filter skulle ge osäkra svar. För att lägga till dem måste man fråga varje organisation direkt. Hundar i nattlogi visas som en notering på kortet.

## Filer

| Fil | Innehåll |
| --- | --- |
| `index.html` | Sidans struktur |
| `css/style.css` | Utseende med ljust och mörkt läge |
| `js/data.js` | Tjänster, öppettider och källor. Uppdatera här. |
| `js/i18n.js` | Översättningar (12 språk) |
| `js/search.js` | Filterlogik som delas av sidan och testerna |
| `js/scenarios.js` | De 10 testscenarierna |
| `js/app.js` | Gränssnitt, flikar, 5 Whys och källor |
| `tests/run-scenarios.js` | Kör scenarierna i Node |
| `tests/check-i18n.js` | Kontrollerar att inget språk saknar text |
| `manifest.webmanifest`, `sw.js`, `icons/` | Det som gör sidan till en app: namn, ikon och offlinestöd |
| `js/helpline.js` | Telefonlinjens hjärna: språk, instruktioner och sökverktyg (delas av `phone/` och `beta/`) |
| `phone/` | Telefonlinjen med AI-röst (Twilio + Claude) |
| `beta/` | Betasida för att testa telefonlinjen utan telefonnummer |
| `render.yaml` | Lägger upp telefonlinjens server på Render |
| `.github/workflows/pages.yml` | Publicerar på GitHub Pages vid push till `main` |

Kontrollera gärna några öppettider mot källorna innan ni presenterar, eftersom de kan ändras. Allt kontrollerades senast 22.10.2026.
