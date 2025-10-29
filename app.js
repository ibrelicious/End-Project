// Bas-URL till PokeAPI
const API = 'https://pokeapi.co/api/v2';

// Ändra till ditt namn/initialer för unikt färgtema (sparas i localStorage)
const USER_SIGNATURE = 'YourNameHere';

// ===== App state =====
// Central "single source of truth" för vylogik och filter.
const state = {
  mode: 'all',     // 'all' = bläddra, 'type' = filtrerat på typ, 'search' = exakt namn/id
  page: 1,         // aktuell sida i paginering
  pageSize: 20,    // antal kort per sida
  total: 0,        // total träffmängd för aktuell vy
  type: '',        // vald typ (tom = alla)
  query: '',       // söksträng (namn/id)
  listCache: [],   // cache för namnen när man filtrerar per typ (API för typ ger enbart namnlistor)
  listCacheType: ''// vilken typ cachen hör till (så vi vet när den är stale)
};

// ===== Elements =====
// Bekväma referenser till DOM-element vi interagerar med ofta.
const el = {
  q: document.querySelector('#q'),
  sort: document.querySelector('#sort'),
  form: document.querySelector('#controls'),
  results: document.querySelector('#results'),
  status: document.querySelector('#status'),
  pager: document.querySelector('#pager'),
  prev: document.querySelector('#prev'),
  next: document.querySelector('#next'),
  pageInfo: document.querySelector('#pageInfo'),
  typeList: document.querySelector('#typeList'),
  drawer: document.querySelector('#drawer'),
  dImg: document.querySelector('#dImg'),
  dId: document.querySelector('#dId'),
  dName: document.querySelector('#dName'),
  dTypes: document.querySelector('#dTypes'),
  dKv: document.querySelector('#dKv'),
  clear: document.querySelector('#clear'),
  sig: document.querySelector('#sig'),
};

// ===== Theme (unik per student) =====
// Enkel deterministic hash av en sträng → heltal
function hashString(str) { let h=0; for (let i=0;i<str.length;i++) { h=(h<<5)-h+str.charCodeAt(i); h|=0; } return Math.abs(h); }
// Härled två HSL-nyanser från "seed" och applicera som CSS-variabler.
// Signaturen visas även i sidfoten så man ser vilket tema som är valt.
function applyTheme(seed) {
  const h1 = hashString(seed) % 360;
  const h2 = (h1 + 40 + (hashString(seed+'x')%80)) % 360;
  document.documentElement.style.setProperty('--accent', `${h1} 85% 58%`);
  document.documentElement.style.setProperty('--accent-2', `${h2} 85% 58%`);
  el.sig.textContent = seed;
}

// ===== Init =====
// Startpunkt: applicera tema, ladda typknappar, läs preferenser och bind events.
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme((localStorage.getItem('pokedex-signature')) || USER_SIGNATURE);
  await populateTypes(); // fyller type-rail från API
  loadPrefs();           // läser sparad sök/typ/sort
  // markera sparad typ-pill om någon fanns
  setActiveTypePill(state.type);
  applyFromControls();   // etablerar korrekt 'mode' och render
  bindEvents();          // klick/submit/ESC osv.
});

// Registrera alla händelser som styr appens beteende.
function bindEvents() {
  // Sök / Sortera (submit på formuläret)
  el.form.addEventListener('submit', (e) => { e.preventDefault(); applyFromControls(); });

  // Paginering bakåt/framåt
  el.prev.addEventListener('click', () => { if (state.page > 1) { state.page--; render(); } });
  el.next.addEventListener('click', () => {
    const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page < maxPage) { state.page++; render(); }
  });

  // Rensa: töm sökfält, nollställ typ och gå till "all"
  el.clear.addEventListener('click', () => {
    el.q.value = '';
    state.type = '';
    state.mode = 'all';
    state.page = 1;
    setActiveTypePill('');
    savePrefs();
    render();
  });

  // "Alla"-pill (knappen högst upp i type-rail)
  document.querySelector('.pill[data-type=""]').addEventListener('click', () => {
    state.type = '';
    state.mode = 'all';
    state.page = 1;
    setActiveTypePill('');
    savePrefs();
    render();
  });

  // Stäng detaljpanelen och stöd för ESC
  el.drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
}

// ===== Persistence =====
// Spara senaste sökning/typ/sort i localStorage
const savePrefs = () => localStorage.setItem('pokedex-prefs', JSON.stringify({ q: el.q.value.trim(), type: state.type, sort: el.sort.value }));
// Läs preferenser vid start (tyst felhantering ifall JSON saknas/trasig)
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('pokedex-prefs'));
    if (p) {
      el.q.value = p.q || '';
      state.type = p.type || '';
      el.sort.value = p.sort || 'id-asc';
    }
  } catch {}
}

// ===== Types rail =====
// Hämtar alla typer (bug, fire, water...) och skapar en knapp per typ.
async function populateTypes() {
  try {
    const res = await fetch(`${API}/type`, { mode: 'cors' });
    if (!res.ok) throw new Error('Failed to load types');
    const data = await res.json();
    el.typeList.innerHTML = '';
    data.results.forEach(t => {
      const b = document.createElement('button');
      b.className = 'pill';
      b.dataset.type = t.name;
      b.textContent = cap(t.name);
      b.addEventListener('click', () => {
        setActiveTypePill(t.name);
        state.type = t.name;
        state.mode = 'type';
        state.page = 1;
        savePrefs();
        render();
      });
      el.typeList.appendChild(b);
    });
  } catch (err) {
    console.error(err);
    setStatus('Kunde inte ladda typer. Du kan fortfarande söka på namn.', 'err');
  }
}

// Visuell/haptisk markering av vilken typ-pill som är aktiv.
function setActiveTypePill(typeName) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.pill[data-type="${CSS.escape(typeName)}"]`) || document.querySelector('.pill[data-type=""]');
  btn.classList.add('active');
}

// ===== Controls → state =====
// Läser av formuläret och ställer in "mode": search/type/all, samt resetar sidan.
function applyFromControls() {
  state.query = el.q.value.trim().toLowerCase();
  state.page = 1;
  savePrefs();
  if (state.query) { state.mode = 'search'; state.type = ''; setActiveTypePill(''); render(); }
  else if (state.type) { state.mode = 'type'; render(); }
  else { state.mode = 'all'; render(); }
}

// ===== Rendering =====
// Huvudfunktionen som hämtar data enligt state och målar korten + paginering.
async function render() {
  setStatus('Laddar…');
  el.results.innerHTML = '';
  el.pager.style.display = 'flex';

  try {
    // 1) Exakt sökning på namn/id → visar en enda träff, ingen paginering.
    if (state.mode === 'search') {
      const poke = await fetchPokemon(state.query);
      state.total = poke ? 1 : 0;
      el.pager.style.display = 'none';
      if (!poke) { setStatus('Hittade ingen Pokémon med det namnet.', 'err'); return; }
      el.results.append(card(poke));
      setStatus('');
      return;
    }

    // 2) Filtrerat på typ → API ger en stor lista med namn; vi cachar den och paginerar lokalt.
    if (state.mode === 'type') {
      // Hämta listan (namn) för vald typ, cachea
      if (!state.listCache.length || state.listCacheType !== state.type) {
        const t = await fetchJson(`${API}/type/${state.type}`);
        state.listCache = t.pokemon.map(p => p.pokemon.name);
        state.listCacheType = state.type;
      }
      state.total = state.listCache.length;
      const pageNames = paginateNames(state.listCache, state.page, state.pageSize);
      const pokes = await Promise.all(pageNames.map(n => fetchPokemon(n)));
      const sorted = sortPokes(pokes.filter(Boolean), el.sort.value);
      mountCards(sorted);
      setStatus('');
    } else {
      // 3) "All" → använd PokeAPIs list-endpoint som redan är paginerad (limit/offset)
      const offset = (state.page - 1) * state.pageSize;
      const list = await fetchJson(`${API}/pokemon?limit=${state.pageSize}&offset=${offset}`);
      state.total = list.count;
      const pokes = await Promise.all(list.results.map(r => fetchPokemon(r.name)));
      const sorted = sortPokes(pokes.filter(Boolean), el.sort.value);
      mountCards(sorted);
      setStatus('');
    }
  } catch (err) {
    console.error(err);
    setStatus('Något gick fel. Försök igen.', 'err');
  }

  // Uppdatera paginerings-UI (aktuell sida / maxsida + disable knappar vid kant)
  const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
  el.pageInfo.textContent = `Sida ${state.page} / ${maxPage}`;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= maxPage;
}

// Sortering enligt användarens val (namn A→Ö eller id stigande)
function sortPokes(arr, how) {
  const copy = [...arr];
  if (how === 'name-asc') copy.sort((a,b) => a.name.localeCompare(b.name));
  else copy.sort((a,b) => a.id - b.id);
  return copy;
}

// Skär ut en sida ur en namnlista (för typ-filtret)
function paginateNames(all, page, pageSize) {
  const start = (page - 1) * pageSize;
  return all.slice(start, start + pageSize);
}

// Liten fetch-hjälpare som kastar vid HTTP-fel
async function fetchJson(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status} för ${url}`);
  return res.json();
}

// Hämtar full Pokémon-detalj (sprites, stats, typer) via namn/id. Returnerar null om ej hittad.
async function fetchPokemon(nameOrId) {
  try {
    return await fetchJson(`${API}/pokemon/${encodeURIComponent(String(nameOrId).toLowerCase())}`);
  } catch {
    return null;
  }
}

// Renderhjälpare: töm grid och lägg in ett card per Pokémon
function mountCards(list) {
  el.results.innerHTML = '';
  list.forEach(p => el.results.append(card(p)));
}

// Skapar ett "card" (article) med bild, namn, id och typ-badges. Klick öppnar detaljpanel.
function card(p) {
  const c = document.createElement('article');
  c.className = 'card';
  c.setAttribute('role','listitem');
  c.innerHTML = `
    <div class="inner">
      <div class="thumb">${imageTag(p)}</div>
      <div class="meta">
        <h3>${cap(p.name)} <span class="id">#${String(p.id).padStart(3,'0')}</span></h3>
        <div class="badges">${p.types.map(t => `<span class="badge" style="${typeStyle(t.type.name)}">${cap(t.type.name)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="watermark">${String(p.id).padStart(3,'0')}</div>`;
  c.addEventListener('click', () => openDrawer(p));
  return c;
}

// Väljer bästa tillgängliga sprite och genererar img-tag eller en placeholder
function imageTag(p) {
  const src = p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default;
  const alt = `${cap(p.name)} officiell artwork`;
  return src ? `<img loading="lazy" src="${src}" alt="${alt}"/>` : `<div style="width:96px;height:96px;border-radius:10px;background:#222"></div>`;
}

// Öppnar detaljpanel och fyller den med bild, id, namn, typer och kv-info (höjd/vikt/förmågor/stats)
function openDrawer(p) {
  el.dImg.src = p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default || '';
  el.dImg.alt = `${cap(p.name)} bild`;
  el.dId.textContent = `#${String(p.id).padStart(3,'0')}`;
  el.dName.textContent = cap(p.name);
  el.dTypes.innerHTML = p.types.map(t => `<span class="badge" style="${typeStyle(t.type.name)}">${cap(t.type.name)}</span>`).join('');
  el.dKv.innerHTML = '';
  const rows = [
    ['Höjd', (p.height/10).toFixed(1) + ' m'],
    ['Vikt', (p.weight/10).toFixed(1) + ' kg'],
    ['Förmågor', p.abilities.map(a => cap(a.ability.name)).join(', ')],
    ['Basstats', p.stats.map(s => `${cap(s.stat.name)}: ${s.base_stat}`).join(' | ')],
  ];
  rows.forEach(([k,v]) => {
    const kEl = document.createElement('div'); kEl.textContent = k; kEl.style.color = 'var(--muted)';
    const vEl = document.createElement('div'); vEl.textContent = v;
    el.dKv.append(kEl, vEl);
  });
  el.drawer.setAttribute('aria-hidden','false');
  // sätt fokus till stäng-knappen för a11y
  queueMicrotask(() => el.drawer.querySelector('.drawer-close').focus());
}
// Stänger panelen
function closeDrawer() { el.drawer.setAttribute('aria-hidden','true'); }

// ===== Helpers =====
// Versaliserar första bokstaven
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Statusrad (visar/byter klass för info/fel)
const setStatus = (msg = '', type = 'info') => {
  if (!msg) { el.status.className = 'status'; el.status.textContent = ''; return; }
  el.status.textContent = msg;
  el.status.className = 'status show' + (type === 'err' ? ' err' : '');
};

// Stabil färg per typ: hash → HSL, används inline på badges för konsek vent tema
function typeStyle(name) {
  const h = (hashString(name) % 360);
  return `background: hsl(${h} 60% 20%); border-color: hsl(${h} 55% 28%); color: white;`;
}
