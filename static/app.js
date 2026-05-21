document.getElementById('search-btn').addEventListener('click', search);
document.getElementById('artist-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') search();
});

// --- 상태 ---
let currentTracks = [];
let sortCol = 'track_popularity';
let sortAsc = false;
let visibleCols = [];
let filters = {}; // { col: { op: 'gte'|'lte', val: number } }

// --- 컬럼 정의 ---
const COLS = [
  { key: 'track_title',    label: '제목',       type: 'string' },
  { key: 'album',          label: '앨범',       type: 'string' },
  { key: 'album_year',     label: '연도',       type: 'string' },
  { key: 'track_popularity', label: '인기도',   type: 'number' },
  { key: 'tempo',          label: 'Tempo',      type: 'number' },
  { key: 'danceability',   label: 'Dance',      type: 'number' },
  { key: 'energy',         label: 'Energy',     type: 'number' },
  { key: 'valence',        label: 'Valence',    type: 'number' },
  { key: 'acousticness',   label: 'Acoustic',   type: 'number' },
  { key: 'speechiness',    label: 'Speech',     type: 'number' },
  { key: 'liveness',       label: 'Live',       type: 'number' },
  { key: 'loudness',       label: 'Loud (dB)',  type: 'number' },
  { key: 'key',            label: 'Key',        type: 'number' },
  { key: 'mode',           label: 'Mode',       type: 'number' },
  { key: 'duration_ms',    label: 'Duration',   type: 'number' },
];

async function search() {
  const artist = document.getElementById('artist-input').value.trim();
  if (!artist) return;

  const res = await fetch(`/tracks?artist=${encodeURIComponent(artist)}`);
  const data = await res.json();

  currentTracks = data.tracks;
  filters = {};
  sortCol = 'track_popularity';
  sortAsc = false;
  visibleCols = COLS.map(c => c.key); // 기본: 전체 ON

  renderMeta(data);
  renderControls();
  renderTable();
}

function renderMeta(data) {
  document.getElementById('result-info').textContent =
    `${data.artist} — 총 ${data.count}개`;
}

// --- 컨트롤 (컬럼 토글 + 필터) ---
function renderControls() {
  const container = document.getElementById('table-container');

  // 컬럼 토글 바
  const toggleBar = document.createElement('div');
  toggleBar.id = 'col-toggles';
  toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;';

  COLS.forEach(col => {
    const btn = document.createElement('button');
    btn.textContent = col.label;
    btn.dataset.col = col.key;
    btn.className = 'col-toggle active';
    btn.onclick = () => toggleCol(col.key, btn);
    toggleBar.appendChild(btn);
  });

  // 필터 영역
  const filterBar = document.createElement('div');
  filterBar.id = 'filter-bar';
  filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center;';

  const filterLabel = document.createElement('span');
  filterLabel.textContent = '필터:';
  filterLabel.style.cssText = 'font-size:12px;opacity:0.6;';
  filterBar.appendChild(filterLabel);

  COLS.filter(c => c.type === 'number').forEach(col => {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:2px;font-size:12px;';

    const lbl = document.createElement('label');
    lbl.textContent = col.label;
    lbl.style.opacity = '0.7';

    const sel = document.createElement('select');
    sel.style.cssText = 'font-size:11px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;';
    ['—', '≥', '≤'].forEach(op => {
      const opt = document.createElement('option');
      opt.value = op;
      opt.textContent = op;
      sel.appendChild(opt);
    });

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.placeholder = '값';
    inp.style.cssText = 'width:52px;font-size:11px;padding:1px 4px;border:1px solid #ccc;border-radius:3px;';

    const apply = () => {
      const op = sel.value;
      const val = parseFloat(inp.value);
      if (op === '—' || isNaN(val)) {
        delete filters[col.key];
      } else {
        filters[col.key] = { op: op === '≥' ? 'gte' : 'lte', val };
      }
      renderTable();
    };
    sel.onchange = apply;
    inp.oninput = apply;

    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    wrap.appendChild(inp);
    filterBar.appendChild(wrap);
  });

  container.innerHTML = '';
  container.appendChild(toggleBar);
  container.appendChild(filterBar);

  injectStyles();
}

function toggleCol(key, btn) {
  if (visibleCols.includes(key)) {
    if (visibleCols.length === 1) return; // 최소 1개
    visibleCols = visibleCols.filter(k => k !== key);
    btn.classList.remove('active');
  } else {
    const order = COLS.map(c => c.key);
    visibleCols.push(key);
    visibleCols.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    btn.classList.add('active');
  }
  renderTable();
}

// --- 테이블 ---
function renderTable() {
  // 기존 table 제거 (컨트롤은 유지)
  const old = document.getElementById('data-table');
  if (old) old.remove();

  // 필터 적용
  const filtered = currentTracks.filter(t => {
    for (const [col, { op, val }] of Object.entries(filters)) {
      const v = parseFloat(t[col]);
      if (op === 'gte' && v < val) return false;
      if (op === 'lte' && v > val) return false;
    }
    return true;
  });

  // 정렬 적용
  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const cols = COLS.filter(c => visibleCols.includes(c.key));

  const table = document.createElement('table');
  table.id = 'data-table';

  // 헤더
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  cols.forEach(col => {
    const th = document.createElement('th');
    const isActive = sortCol === col.key;
    th.innerHTML = `${col.label} <span class="sort-arrow">${isActive ? (sortAsc ? '↑' : '↓') : '↕'}</span>`;
    th.dataset.col = col.key;
    th.onclick = () => {
      if (sortCol === col.key) sortAsc = !sortAsc;
      else { sortCol = col.key; sortAsc = false; }
      renderTable();
    };
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 바디
  const tbody = document.createElement('tbody');
  sorted.forEach(track => {
    const tr = document.createElement('tr');
    cols.forEach(col => {
      const td = document.createElement('td');
      let val = track[col.key];
      if (col.type === 'number' && !Number.isInteger(val)) val = parseFloat(val).toFixed(3);
      td.textContent = val ?? '—';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  document.getElementById('table-container').appendChild(table);
}

// --- 스타일 주입 (한 번만) ---
function injectStyles() {
  if (document.getElementById('table-styles')) return;
  const style = document.createElement('style');
  style.id = 'table-styles';
  style.textContent = `
    #col-toggles .col-toggle {
      font-size: 11px;
      padding: 3px 8px;
      border: 1px solid #aaa;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      opacity: 0.45;
      transition: opacity .15s, background .15s;
    }
    #col-toggles .col-toggle.active {
      background: #222;
      color: #fff;
      border-color: #222;
      opacity: 1;
    }
    #data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 4px;
    }
    #data-table th {
      text-align: left;
      padding: 6px 10px;
      border-bottom: 2px solid #222;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
    }
    #data-table th:hover { background: #f5f5f5; }
    #data-table td {
      padding: 5px 10px;
      border-bottom: 1px solid #eee;
      white-space: nowrap;
    }
    #data-table tbody tr:hover { background: #fafafa; }
    .sort-arrow { opacity: 0.4; font-size: 10px; }
  `;
  document.head.appendChild(style);
}

