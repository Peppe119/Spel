# Geneva Help Finder

En flerspråkig hjälpguide för Genève, gjord för ett hackathon. Den visar gratis mat, dusch, tvätt, kläder, vård, matkassar och nattlogi. Sidan har 18 riktiga ställen hämtade från stadens officiella lista (juli 2026) och från Colis du Cœurs egen sida. Varje kort visar sin källa och datum.

## Kör

Sidan är ren HTML, CSS och JS och behöver inte byggas. Öppna `index.html` direkt, eller starta en lokal server:

```sh
npm start          # http://localhost:8000
npm test           # kör de 10 testscenarierna (Node)
```

## Funktioner

- **5 språk:** franska, engelska, arabiska (höger till vänster), ukrainska och spanska.
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
| `js/i18n.js` | Översättningar |
| `js/search.js` | Filterlogik som delas av sidan och testerna |
| `js/scenarios.js` | De 10 testscenarierna |
| `js/app.js` | Gränssnitt, flikar, 5 Whys och källor |
| `tests/run-scenarios.js` | Kör scenarierna i Node |

Kontrollera gärna några öppettider mot källorna innan ni presenterar, eftersom de kan ändras. Allt kontrollerades senast 22.10.2026.
