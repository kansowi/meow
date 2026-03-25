// ── password ──────────────────────────────────────────────────────────────
// SHA-256 hash of your chosen password.
// To change: open browser console and run:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
//
const PASSWORD_HASH = '026b1c944787f22022c88d23f370b51caf1538053526311a448db3b559250c49';

const SESSION_KEY = 'meow_auth';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── gate logic ────────────────────────────────────────────────────────────
const gate    = document.getElementById('gate');
const archive = document.getElementById('archive');
const form    = document.getElementById('gate-form');
const input   = document.getElementById('gate-input');
const errMsg  = document.getElementById('gate-error');
const card    = document.querySelector('.gate-card');

function unlock() {
  sessionStorage.setItem(SESSION_KEY, '1');
  gate.classList.add('hidden');
  archive.classList.add('visible');
  loadArchive();
}

// skip gate if already authenticated this session
if (sessionStorage.getItem(SESSION_KEY)) {
  gate.classList.add('hidden');
  archive.classList.add('visible');
  loadArchive();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const hash = await sha256(input.value);
  if (hash === PASSWORD_HASH) {
    errMsg.classList.remove('visible');
    unlock();
  } else {
    errMsg.textContent = 'wrong password :(';
    errMsg.classList.add('visible');
    card.classList.remove('shake');
    void card.offsetWidth; // reflow to restart animation
    card.classList.add('shake');
    input.value = '';
    input.focus();
  }
});

// ── archive ───────────────────────────────────────────────────────────────
let allResources = [];
let activeType   = 'all';
let activeTag    = null;
let searchQuery  = '';

async function loadArchive() {
  try {
    const res  = await fetch('resources.json');
    const data = await res.json();
    allResources = data.resources ?? [];

    // set title
    const titleEl = document.getElementById('site-title');
    if (titleEl) titleEl.textContent = data.title ?? 'archive';

    buildTagFilters();
    render();
  } catch (err) {
    console.error('failed to load resources.json', err);
  }
}

// ── tag filter pills ───────────────────────────────────────────────────────
function buildTagFilters() {
  const tags = [...new Set(allResources.flatMap(r => r.tags ?? []))].sort();
  const wrap = document.getElementById('tag-filters');
  wrap.innerHTML = '';

  if (!tags.length) return;

  const divider = document.createElement('div');
  divider.className = 'filter-divider';
  wrap.appendChild(divider);

  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-pill-filter';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      document.querySelectorAll('.tag-pill-filter').forEach(b => {
        b.classList.toggle('active', b.dataset.tag === activeTag);
      });
      render();
    });
    wrap.appendChild(btn);
  });
}

// ── type tabs ──────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeType = tab.dataset.type;
    document.querySelectorAll('.filter-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.type === activeType)
    );
    render();
  });
});

// ── search ─────────────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase().trim();
  render();
});

// ── render ─────────────────────────────────────────────────────────────────
function render() {
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  const filtered = allResources.filter(r => {
    if (activeType !== 'all' && r.type !== activeType) return false;
    if (activeTag && !(r.tags ?? []).includes(activeTag)) return false;
    if (searchQuery) {
      const hay = [r.title, r.description, r.content, ...(r.tags ?? [])].join(' ').toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✦</span>
        nothing here yet
      </div>`;
    return;
  }

  filtered.forEach((r, i) => {
    const el = r.type === 'link' ? linkCard(r, i) : noteCard(r, i);
    grid.appendChild(el);
  });
}

// ── card builders ──────────────────────────────────────────────────────────
function tagPills(tags = [], type) {
  return (tags).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
}

function cardFooter(r) {
  return `
    <div class="card-footer">
      <div class="card-tags">${tagPills(r.tags)}</div>
      ${r.date ? `<span class="card-date">${formatDate(r.date)}</span>` : ''}
    </div>`;
}

function linkCard(r, i) {
  const el = document.createElement('article');
  el.className = 'card type-link';
  el.style.animationDelay = `${i * 0.04}s`;
  el.innerHTML = `
    <div class="card-header">
      <span class="card-icon">🔗</span>
      <a class="card-title" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
    </div>
    ${r.description ? `<p class="card-desc">${esc(r.description)}</p>` : ''}
    ${cardFooter(r)}`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    window.open(r.url, '_blank', 'noopener,noreferrer');
  });
  return el;
}

function noteCard(r, i) {
  const el = document.createElement('article');
  el.className = 'card type-note';
  el.style.animationDelay = `${i * 0.04}s`;
  el.innerHTML = `
    <div class="card-header">
      <span class="card-icon">✎</span>
      <span class="card-title">${esc(r.title)}</span>
    </div>
    ${r.content ? `<p class="card-note-content">${esc(r.content)}</p>` : ''}
    ${cardFooter(r)}`;
  return el;
}

// ── utils ──────────────────────────────────────────────────────────────────
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(str) {
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(str));
  } catch {
    return str;
  }
}
