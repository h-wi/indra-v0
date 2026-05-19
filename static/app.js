document.getElementById('search-btn').addEventListener('click', search);
document.getElementById('artist-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') search();
});

async function search() {
  const artist = document.getElementById('artist-input').value.trim();
  if (!artist) return;

  const res = await fetch(`/tracks?artist=${encodeURIComponent(artist)}`);
  const data = await res.json();

  renderMeta(data);
  renderTable(data.tracks);  // 나중에 표로 교체할 함수
}

function renderMeta(data) {
  document.getElementById('result-info').textContent =
    `${data.artist} — 총 ${data.count}개`;
}

function renderTable(tracks) {
  // 지금은 JSON, 나중에 <table>로 교체
  const container = document.getElementById('table-container');
  container.innerHTML = `<pre>${JSON.stringify(tracks, null, 2)}</pre>`;
}
