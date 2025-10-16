# End-Project
# Pokedex — Unique Layout Edition

En single-page webbapp som hämtar data från **PokeAPI** och låter dig:
- Söka Pokémon på namn
- Filtrera via typ (vänster “type rail”)
- Sortera (ID eller namn)
- Bläddra med paginering
- Se detaljer i en högersides “inspector”

## Varför unik?
Layouten är **trepanig** (typ-rail / resultatgrid / detaljpanel) och temat skapas från en personlig **USER_SIGNATURE** i `app.js`, så färger/gradienter blir dina.

## Tech
- **HTML** (semantisk)
- **CSS** (Grid/Flex, responsivt)
- **Vanilla JS** med `fetch`
- Ingen server eller databas. (Valfritt: `localStorage` för preferenser.)

## API
- Källa: https://pokeapi.co/ (öppet, ingen nyckel)
- Slutpunkter:
  - `GET /api/v2/pokemon?limit=&offset=`
  - `GET /api/v2/pokemon/{name}`
  - `GET /api/v2/type` och `GET /api/v2/type/{type}`

## Kör lokalt
1. Öppna `index.html` i en modern webbläsare.
2. (WebStorm) Högerklicka på `index.html` → **Open in Browser**.

## Publicera (GitHub Pages)
1. Skapa repo, lägg in `index.html`, `style.css`, `app.js`.
2. **Settings → Pages** → “Deploy from branch” → `main` → `/(root)`.
3. Vänta på bygg, besök den genererade länken.

## Anpassning
- Öppna `app.js` och ändra:
  ```js
  const USER_SIGNATURE = 'DittNamn';
