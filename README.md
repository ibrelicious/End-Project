# End-Project Pokedex

En single sida webbapp som hämtar data från **PokeAPI** och låter dig:
- Söka Pokémon med namn
- Filtrera via typ
- Sortera (ID eller namn)
- Bläddra
- Se detaljer i en högersides “inspector”

## Tech
- **HTML** (semantisk)
- **CSS** (Grid/Flex, responsivt)
- **Vanilla JS** med `fetch`

## API
- Källa: https://pokeapi.co/ (öppet, ingen nyckel)
- Slutpunkter:
  - `GET /api/v2/pokemon?limit=&offset=`
  - `GET /api/v2/pokemon/{name}`
  - `GET /api/v2/type` och `GET /api/v2/type/{type}`

## Kör lokalt
1. Öppna `index.html` i en webbläsare.

## Anpassning
- Öppna `app.js` och ändra:
  ```js
  const USER_SIGNATURE = 'DittNamn';
