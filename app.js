/* ============================================
   ResearchLens by Sayan Mahata (sayan9168)
   Data source: OpenAlex - free open scholarly catalog
   ============================================ */

const API_BASE = "https://api.openalex.org/works";
const MAILTO = "sm6881164@gmail.com"; // polite pool (recommended by OpenAlex)

let trendChart = null;

/* ---------- Populate year dropdowns ---------- */
(function populateYears() {
    const currentYear = new Date().getFullYear();
    const fromSel = document.getElementById('year-from');
    const toSel = document.getElementById('year-to');
    for (let y = currentYear; y >= 1990; y--) {
        fromSel.add(new Option(y, y));
        toSel.add(new Option(y, y));
    }
})();

const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

/* ---------- Main search function ---------- */
async function runSearch() {
    const query = searchInput.value.trim();
    if (!query) { searchInput.focus(); return; }

    showLoader(true);
    clearResults();
    try {
        const data = await fetchOpenAlex(query);
        const works = data.results || [];
        if (works.length === 0) {
            showEmpty("No papers found for this topic. Try another keyword.");
        } else {
            renderResults(works);
            updateStats(works, data.meta);
            buildTrendChart(works);
        }
    } catch (err) {
        console.error(err);
        showEmpty("Something went wrong while fetching data. Please try again.");
    } finally {
        showLoader(false);
    }
}

/* ---------- Build API URL ---------- */
function buildUrl(query) {
    let url = `${API_BASE}?search=${encodeURIComponent(query)}&per-page=50&mailto=${MAILTO}`;
    const from = document.getElementById('year-from').value;
    const to = document.getElementById('year-to').value;
    const filters = [];
    if (from) filters.push(`from_publication_date:${from}-01-01`);
    if (to) filters.push(`to_publication_date:${to}-12-31`);
    if (filters.length) url += `&filter=${filters.join(',')}`;
    const sort = document.getElementById('sort-by').value;
    if (sort && sort !== 'relevance_score:desc') url += `&sort=${sort}`;
    return url;
}

async function fetchOpenAlex(query) {
    const res = await fetch(buildUrl(query));
    if (!res.ok) throw new Error('API error: ' + res.status);
    return await res.json();
}

/* ---------- Render result cards ---------- */
function renderResults(works) {
    const grid = document.getElementById('results');
    grid.innerHTML = '';
    works.forEach((w, i) => {
        const title = w.display_name || 'Untitled';
        const year = w.publication_year || 'N/A';
        const cites = (w.cited_by_count || 0).toLocaleString();
        const authors = (w.authorships || []).slice(0, 3)
            .map(a => a.author?.display_name).filter(Boolean).join(', ');
        const venue = w.primary_location?.source?.display_name || '';
        const link = w.doi || w.id;
        const isOA = w.open_access?.is_oa;

        const card = document.createElement('article');
        card.className = 'paper-card';
        card.style.animationDelay = (i * 0.04) + 's';
        card.innerHTML = `
            <div class="paper-top">
                <span class="year-badge">${year}</span>
                ${isOA ? '<span class="oa-badge"><i class="fas fa-lock-open"></i> Open Access</span>' : ''}
            </div>
            <h3 class="paper-title">${escapeHtml(title)}</h3>
            ${authors ? `<p class="paper-authors"><i class="fas fa-users"></i> ${escapeHtml(authors)}</p>` : ''}
            ${venue ? `<p class="paper-venue"><i class="fas fa-journal-whills"></i> ${escapeHtml(venue)}</p>` : ''}
            <div class="paper-footer">
                <span class="citations"><i class="fas fa-quote-right"></i> ${cites} citations</span>
                ${link ? `<a href="${link}" target="_blank" class="read-link">Read <i class="fas fa-external-link-alt"></i></a>` : ''}
            </div>`;
        grid.appendChild(card);
    });
}

/* ---------- Update statistics ---------- */
function updateStats(works, meta) {
    const total = meta?.count || works.length;
    const totalCites = works.reduce((s, w) => s + (w.cited_by_count || 0), 0);
    const years = works.map(w => w.publication_year).filter(Boolean);
    const latest = years.length ? Math.max(...years) : '-';
    const oaCount = works.filter(w => w.open_access?.is_oa).length;
    const oaPct = works.length ? Math.round((oaCount / works.length) * 100) : 0;

    animateNumber('stat-total', total);
    animateNumber('stat-cited', totalCites);
    document.getElementById('stat-year').textContent = latest;
    document.getElementById('stat-oa').textContent = oaPct + '%';
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const timer = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(timer); }
        el.textContent = cur.toLocaleString();
    }, 20);
}

/* ---------- Build trend chart ---------- */
function buildTrendChart(works) {
    const yearCount = {};
    works.forEach(w => {
        if (w.publication_year) yearCount[w.publication_year] = (yearCount[w.publication_year] || 0) + 1;
    });
    const sortedYears = Object.keys(yearCount).map(Number).sort((a, b) => a - b);
    const counts = sortedYears.map(y => yearCount[y]);

    const ctx = document.getElementById('trend-chart').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedYears,
            datasets: [{
                label: 'Publications',
                data: counts,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56,189,248,0.15)',
                fill: true, tension: 0.35,
                pointBackgroundColor: '#a855f7', pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true }
            }
        }
    });
}

/* ---------- Helpers ---------- */
function showLoader(show) {
    document.getElementById('loader').classList.toggle('hidden', !show);
    if (show) document.getElementById('empty-state').classList.add('hidden');
}
function clearResults() { document.getElementById('results').innerHTML = ''; }
function showEmpty(msg) {
    const es = document.getElementById('empty-state');
    es.classList.remove('hidden');
    es.querySelector('p').textContent = msg;
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
