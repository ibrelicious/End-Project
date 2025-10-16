const API = 'https://pokeapi.co/api/v2';

// App state
const state = {
  mode: 'all',       // 'all' | 'type' | 'search'
  page: 1,
  pageSize: 20,
  total: 0,
  type: '',
  query: '',
  listCache: [],     // used when filtering by type (list of names)
};

// Elements
const el = {
  q: document.querySelector('#q'),
  type: document.querySelector('#type'),
  sort: document.querySelector('#sort'),
  form: document.querySelector('#controls'),
  results: document.querySelector('#results'),
  status: document.querySelector('#status'),
  pager: document.querySelector('#pager'),
  prev: document.querySelector('#prev'),
  next: document.querySelector('#next'),
  pageInfo: document.querySelector('#pageInfo'),
  dialog: document.querySelector('#detail'),
  dImg: document.querySelector('#dImg'),
  dName: document.querySelector('#dName'),
  dKv: document.querySelector('#dKv'),
  clear: document.querySelector('#clear'),
};

// Utils
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const setStatus = (msg = '', type = 'info') => {
  if (!msg) { el.status.className = 'status'; el.status.textContent = ''; return; }
  el.status.textContent = msg;
  el.status.className = 'status show' + (type === 'err' ? ' err' : '');
};
const savePrefs = () => localStorage.setItem('pokedex-prefs', JSON.stringify({ q: el.q.value.trim(), type: el.type.value, sort: el.sort.value }));
const loadPrefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem('pokedex-prefs'));
    if (p) {
      el.q.value = p.q || '';
      el.type.value = p.type || '';
      el.sort.value = p.sort || 'id-asc';
    }
  } catch {}
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await populateTypes();
  loadPrefs();
  applyFromControls();
  bindEvents();
});

function bindEvents() {
  el.form.addEventListener('submit', (e) => { e.preventDefault(); applyFromControls(); });
  el.prev.addEventListener('click', () => { if (state.page > 1) { state.page--; render(); } });
  el.next.addEventListener('click', () => {
    const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page < maxPage) { state.page++; render(); }
  });
  el.clear.addEventListener('click', () => {
    el.q.value = ''; el.type.value = ''; el.sort.value = 'id-asc';
    savePrefs(); state.page = 1; state.mode = 'all'; render();
  });
}

async function populateTypes() {
  try {
    const res = await fetch(`${API}/type`);
    if (!res.ok) throw new Error('Failed to load types');
    const data = await res.json();
    const opts = data.results.map(t => `<option value="${t.name}">${cap(t.name)}</option>`).join('');
    el.type.insertAdjacentHTML('beforeend', opts);
  } catch (err) {
    console.error(err);
    setStatus('Could not load types. You can still search by name.', 'err');
  }
}

function applyFromControls() {
  state.query = el.q.value.trim().toLowerCase();
  state.type = el.type.value;
  state.page = 1;
  savePrefs();
  if (state.query) { state.mode = 'search'; render(); }
  else if (state.type) { state.mode = 'type'; render(); }
  else { state.mode = 'all'; render(); }
}

async function render() {
  setStatus('Loading…');
  el.results.innerHTML = '';
  el.pager.style.display = 'flex';

  try {
    if (state.mode === 'search') {
      const poke = await fetchPokemon(state.query);
      state.total = poke ? 1 : 0;
      el.pager.style.display = 'none';
      if (!poke) { setStatus('No Pokémon found with that name.', 'err'); return; }
      el.results.append(card(poke));
      setStatus('');
      return;
    }

    if (state.mode === 'type') {
      // If we don't have the list yet, fetch it (names only)
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
      // mode === 'all'
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
    setStatus('Something went wrong. Please try again.', 'err');
  }

  const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize));
  el.pageInfo.textContent = `Page ${state.page} / ${maxPage}`;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= maxPage;
}

function sortPokes(arr, how) {
  const copy = [...arr];
  if (how === 'name-asc') copy.sort((a,b) => a.name.localeCompare(b.name));
  else copy.sort((a,b) => a.id - b.id);
  return copy;
}

function paginateNames(all, page, pageSize) {
  const start = (page - 1) * pageSize; return all.slice(start, start + pageSize);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchPokemon(name) {
  try {
    const data = await fetchJson(`${API}/pokemon/${encodeURIComponent(name.toLowerCase())}`);
    return data;
  } catch (_) {
    return null;
  }
}

function mountCards(list) {
  el.results.innerHTML = '';
  list.forEach(p => el.results.append(card(p)));
}

function card(p) {
  const c = document.createElement('article');
  c.className = 'card';
  c.setAttribute('role','listitem');
  c.innerHTML = `
    <div class="thumb">${imageTag(p)}</div>
    <div class="meta">
      <h3>${cap(p.name)} <span class="id">#${String(p.id).padStart(3,'0')}</span></h3>
      <div class="badges">${p.types.map(t => `<span class="badge">${cap(t.type.name)}</span>`).join('')}</div>
    </div>
  `;
  c.addEventListener('click', () => openDetail(p));
  return c;
}

function imageTag(p) {
  const src = p.sprites.other?.['official-artwork']?.front_default || p.sprites.front_default;
  const alt = `${cap(p.name)} official artwork`;
  return src ? `<img loading="lazy" src="${src}" alt="${alt}"/>` : `<div style="width:80px;height:80px;border-radius:8px;background:#222"></div>`;
}

function openDetail(p) {
  el.dImg.src = p.sprites.other?.['official-artwork']?.front_default || p.sprites.front_default || '';
  el.dImg.alt = `${cap(p.name)} image`;
  el.dName.textContent = `${cap(p.name)}  #${p.id}`;
  el.dKv.innerHTML = '';
  const rows = [
    ['Types', p.types.map(t => cap(t.type.name)).join(', ')],
    ['Height', (p.height/10).toFixed(1) + ' m'],
    ['Weight', (p.weight/10).toFixed(1) + ' kg'],
    ['Abilities', p.abilities.map(a => cap(a.ability.name)).join(', ')],
    ['Base stats', p.stats.map(s => `${cap(s.stat.name)}: ${s.base_stat}`).join(' | ')],
  ];
  rows.forEach(([k,v]) => {
    const kEl = document.createElement('div'); kEl.textContent = k; kEl.style.color = 'var(--muted)';
    const vEl = document.createElement('div'); vEl.textContent = v;
    el.dKv.append(kEl, vEl);
  });
  if (!el.dialog.open) el.dialog.showModal();
}

// Close dialog on backdrop click
el.dialog?.addEventListener('click', (e) => {
  const rect = el.dialog.getBoundingClientRect();
  const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!inDialog) el.dialog.close();
});
