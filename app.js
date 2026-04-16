// ===== State =====
const STORAGE_KEY = 'realanalysis_buckets';
const FILTER_STORAGE_KEY = 'realanalysis_filters';
const NAME_STORAGE_KEY = 'realanalysis_username';
const BANNED_USERS = ['alex'];
let userName = localStorage.getItem(NAME_STORAGE_KEY) || '';
let syncInterval = null;
let allItems = [];
let currentItem = null;
let buckets = {}; // { itemId: 'green' | 'yellow' | 'red' }
let sequentialMode = false;
let sequentialIndex = 0;

// Active filters
let activeFilters = {
  chapters: new Set([1, 2, 3, 4, 5, 6, 7]),
  types: new Set(['definition', 'result']),
  buckets: new Set(['unseen', 'red', 'yellow', 'green'])
};

// Chapter names
const CHAPTER_NAMES = {
  1: 'The Real Numbers',
  2: 'Sequences of Real Numbers',
  3: 'Sequences in R^d',
  4: 'Some Topology in R^d',
  5: 'Infinite Series',
  6: 'Sequences of Functions',
  7: 'Power Series and Taylor Series'
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Ban check
  if (userName && BANNED_USERS.includes(userName.toLowerCase())) {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:#000;color:#ef4444;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:monospace;text-align:center;padding:20px;">
        <h1 style="font-size:80px;margin-bottom:20px;letter-spacing:8px;">YOU'RE BANNED</h1>
        <p style="font-size:18px;color:#9ca3af;">no cheaters allowed in barty's palace</p>
      </div>
    `;
    return;
  }
  if (typeof QUESTIONS !== 'undefined') {
    allItems = QUESTIONS;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { buckets = JSON.parse(saved); } catch(e) { buckets = {}; }
  }

  setupFilterChips();
  setupDivider();
  setupProfClick();
  setupBucketButtons();
  setupQuickFilters();
  setupModal();
  setupModeToggle();
  setupExport();
  setupDatabase();
  setupLanding();
  setupHelpBtn();
  setupNamePrompt();
  setupLeaderboard();
  updateStats();
  renderTimeline(true);
  startSync();
  startVersionCheck();
});

// ===== Type classification =====
function getDisplayType(item) {
  return item.type === 'definition' ? 'definition' : 'result';
}

function getOriginalType(item) {
  return item.type; // theorem, proposition, lemma, corollary, definition
}

// ===== Filters =====
function saveFilters() {
  const data = {
    chapters: Array.from(activeFilters.chapters),
    types: Array.from(activeFilters.types),
    buckets: Array.from(activeFilters.buckets)
  };
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(data));
}

function loadFilters() {
  const saved = localStorage.getItem(FILTER_STORAGE_KEY);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    activeFilters.chapters = new Set(data.chapters);
    activeFilters.types = new Set(data.types);
    activeFilters.buckets = new Set(data.buckets);
    syncChipUI();
  } catch(e) { /* ignore */ }
}

function syncChipUI() {
  document.querySelectorAll('#chapter-filters .chip').forEach(chip => {
    const ch = parseInt(chip.dataset.chapter);
    chip.classList.toggle('active', activeFilters.chapters.has(ch));
  });
  document.querySelectorAll('#type-filters .chip').forEach(chip => {
    chip.classList.toggle('active', activeFilters.types.has(chip.dataset.type));
  });
  document.querySelectorAll('#bucket-filters .chip').forEach(chip => {
    chip.classList.toggle('active', activeFilters.buckets.has(chip.dataset.bucket));
  });
}

function setupFilterChips() {
  loadFilters();

  document.querySelectorAll('#chapter-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const ch = parseInt(chip.dataset.chapter);
      if (chip.classList.contains('active')) {
        activeFilters.chapters.add(ch);
      } else {
        activeFilters.chapters.delete(ch);
      }
      saveFilters();
    });
  });

  document.querySelectorAll('#type-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const t = chip.dataset.type;
      if (chip.classList.contains('active')) {
        activeFilters.types.add(t);
      } else {
        activeFilters.types.delete(t);
      }
      saveFilters();
    });
  });

  document.querySelectorAll('#bucket-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const b = chip.dataset.bucket;
      if (chip.classList.contains('active')) {
        activeFilters.buckets.add(b);
      } else {
        activeFilters.buckets.delete(b);
      }
      saveFilters();
    });
  });
}

function getFilteredItems() {
  return allItems.filter(item => {
    if (!activeFilters.chapters.has(item.chapter)) return false;

    const displayType = getDisplayType(item);
    if (!activeFilters.types.has(displayType)) return false;

    const itemBucket = buckets[item.id] || 'unseen';
    if (!activeFilters.buckets.has(itemBucket)) return false;

    return true;
  });
}

// ===== Resizable Divider =====
function setupDivider() {
  const divider = document.getElementById('divider');
  const pdfPanel = document.getElementById('pdf-panel');
  const quizPanel = document.getElementById('quiz-panel');
  let isDragging = false;

  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const container = document.getElementById('split-panel');
    const containerRect = container.getBoundingClientRect();
    const pct = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const clamped = Math.max(20, Math.min(80, pct));
    pdfPanel.style.flex = `0 0 ${clamped}%`;
    quizPanel.style.flex = `0 0 ${100 - clamped}%`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// ===== Prof Click → Serve Question =====
function setupProfClick() {
  const profContainer = document.getElementById('prof-container');
  const wrapper = document.getElementById('prof-face-wrapper');

  profContainer.addEventListener('click', () => {
    wrapper.classList.remove('thinking');
    void wrapper.offsetWidth;
    wrapper.classList.add('thinking');

    setTimeout(() => {
      serveQuestion();
    }, 700);
  });
}

function serveQuestion(specificItem) {
  const filtered = getFilteredItems();

  if (filtered.length === 0) {
    showNoQuestions();
    return;
  }

  if (specificItem) {
    currentItem = specificItem;
    // Sync sequential index to this item's position
    const pos = filtered.findIndex(i => i.id === specificItem.id);
    if (pos >= 0) sequentialIndex = pos + 1;
  } else {
    let idx;
    if (sequentialMode) {
      if (sequentialIndex >= filtered.length) sequentialIndex = 0;
      idx = sequentialIndex;
      sequentialIndex++;
    } else {
      idx = Math.floor(Math.random() * filtered.length);
    }
    currentItem = filtered[idx];
  }

  showItemOnCard(currentItem);

  // "Open in Notes" button — only navigates PDF on click
  document.getElementById('open-in-notes').onclick = () => navigatePDF(currentItem.pdfPage);

  const card = document.getElementById('question-card');
  card.classList.remove('hidden');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';

  document.getElementById('bucket-buttons').classList.remove('hidden');
  document.getElementById('prof-prompt').textContent = 'Click for another!';

  renderTimeline();
}

function showNoQuestions() {
  const card = document.getElementById('question-card');
  const badge = document.getElementById('question-type-badge');
  const label = document.getElementById('question-label');
  const statement = document.getElementById('question-statement');

  badge.textContent = '';
  badge.className = '';
  label.textContent = '';
  statement.textContent = 'No questions match your current filters. Try adjusting the filters above.';
  card.classList.remove('hidden');
  document.getElementById('bucket-buttons').classList.add('hidden');
  document.getElementById('open-in-notes').onclick = null;
}

// ===== PDF Navigation (only on explicit click) =====
function navigatePDF(pdfPage) {
  const viewer = document.getElementById('pdf-viewer');
  // Replace iframe to force a full fresh load — most reliable cross-browser
  const parent = viewer.parentNode;
  const newViewer = document.createElement('iframe');
  newViewer.id = 'pdf-viewer';
  newViewer.title = 'Course Notes PDF';
  newViewer.src = `281_notes.pdf#page=${pdfPage - 1}&view=Fit`;
  parent.replaceChild(newViewer, viewer);
}

// ===== Bucket Buttons =====
function setupBucketButtons() {
  document.getElementById('btn-green').addEventListener('click', () => bucketCurrent('green'));
  document.getElementById('btn-yellow').addEventListener('click', () => bucketCurrent('yellow'));
  document.getElementById('btn-red').addEventListener('click', () => bucketCurrent('red'));
  document.getElementById('btn-unseen').addEventListener('click', () => {
    if (!currentItem) return;
    delete buckets[currentItem.id];
    saveBuckets();
    updateStats();
    renderTimeline();
    serveQuestion();
  });
  document.getElementById('btn-skip').addEventListener('click', () => serveQuestion());
}

function bucketCurrent(color) {
  if (!currentItem) return;
  buckets[currentItem.id] = color;
  saveBuckets();
  updateStats();
  serveQuestion();
}

function saveBuckets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
  pushProgress();
}

// ===== Quick Filters =====
function setupQuickFilters() {
  document.getElementById('review-red').addEventListener('click', () => setOnlyBucketFilter('red'));
  document.getElementById('review-yellow').addEventListener('click', () => setOnlyBucketFilter('yellow'));
  document.getElementById('reset-all').addEventListener('click', () => {
    if (confirm('Reset all progress? This clears all your green/yellow/red ratings.')) {
      buckets = {};
      saveBuckets();
      updateStats();
    }
  });
}

function setOnlyBucketFilter(bucket) {
  activeFilters.buckets = new Set([bucket]);
  document.querySelectorAll('#bucket-filters .chip').forEach(chip => {
    if (chip.dataset.bucket === bucket) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  saveFilters();
}

// ===== Stats =====
function updateStats() {
  const total = allItems.length;
  const seen = Object.keys(buckets).length;
  let greenCount = 0, yellowCount = 0, redCount = 0;

  Object.values(buckets).forEach(b => {
    if (b === 'green') greenCount++;
    else if (b === 'yellow') yellowCount++;
    else if (b === 'red') redCount++;
  });

  document.getElementById('stat-total').textContent = `${seen} / ${total} seen`;
  document.querySelector('#stat-buckets .stat-chip.green').textContent = greenCount;
  document.querySelector('#stat-buckets .stat-chip.yellow').textContent = yellowCount;
  document.querySelector('#stat-buckets .stat-chip.red').textContent = redCount;

  const chapContainer = document.getElementById('chapter-progress');
  chapContainer.innerHTML = '';

  for (let ch = 1; ch <= 7; ch++) {
    const chapItems = allItems.filter(i => i.chapter === ch);
    if (chapItems.length === 0) continue;

    const chGreen = chapItems.filter(i => buckets[i.id] === 'green').length;
    const chYellow = chapItems.filter(i => buckets[i.id] === 'yellow').length;
    const chRed = chapItems.filter(i => buckets[i.id] === 'red').length;
    const chTotal = chapItems.length;

    const bar = document.createElement('div');
    bar.className = 'chapter-bar';
    bar.dataset.chapter = ch;
    bar.innerHTML = `
      <span class="chapter-bar-label">Ch ${ch}</span>
      <div class="chapter-bar-track">
        <div class="chapter-bar-fill-green" style="width: ${(chGreen / chTotal) * 100}%"></div>
        <div class="chapter-bar-fill-yellow" style="width: ${(chYellow / chTotal) * 100}%"></div>
        <div class="chapter-bar-fill-red" style="width: ${(chRed / chTotal) * 100}%"></div>
      </div>
      <span class="chapter-bar-count">${chGreen + chYellow + chRed}/${chTotal}</span>
    `;

    // Clickable — opens chapter detail modal
    bar.addEventListener('click', () => openChapterModal(ch));
    chapContainer.appendChild(bar);
  }
}

// ===== Chapter Detail Modal =====
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('chapter-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('chapter-modal')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lbModal = document.getElementById('leaderboard-modal');
      if (!lbModal.classList.contains('hidden')) {
        lbModal.classList.add('hidden');
        return;
      }
      const dbModal = document.getElementById('database-modal');
      if (!dbModal.classList.contains('hidden')) {
        dbModal.classList.add('hidden');
        return;
      }
      const modal = document.getElementById('chapter-modal');
      if (!modal.classList.contains('hidden')) {
        closeModal();
        return;
      }
      const howItWorks = document.getElementById('how-it-works-overlay');
      if (howItWorks && !howItWorks.classList.contains('hidden')) {
        howItWorks.classList.add('hidden');
      }
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (document.activeElement.tagName === 'INPUT') return;

      const filtered = getFilteredItems();
      if (filtered.length === 0 || !currentItem) return;

      const currentIdx = filtered.findIndex(i => i.id === currentItem.id);
      let newIdx;

      if (e.key === 'ArrowLeft') {
        newIdx = currentIdx <= 0 ? filtered.length - 1 : currentIdx - 1;
      } else if (e.key === 'ArrowRight') {
        newIdx = currentIdx >= filtered.length - 1 ? 0 : currentIdx + 1;
      } else {
        // Up/Down: jump by dots-per-row
        const track = document.getElementById('timeline-track');
        const trackWidth = track.clientWidth;
        const dotsPerRow = Math.max(1, Math.floor(trackWidth / 20)); // 18px dot + 2px gap
        const step = e.key === 'ArrowUp' ? -dotsPerRow : dotsPerRow;
        newIdx = currentIdx + step;
        if (newIdx >= filtered.length) {
          // Past bottom: go to top of next column (one to the right)
          const col = currentIdx % dotsPerRow;
          const nextCol = col + 1;
          if (nextCol >= dotsPerRow || nextCol >= filtered.length) return;
          newIdx = nextCol;
        } else if (newIdx < 0) {
          // Past top: go to bottom of previous column (one to the left)
          const col = currentIdx % dotsPerRow;
          const prevCol = col - 1;
          if (prevCol < 0) return;
          // Find the last row that has an item in prevCol
          const totalRows = Math.ceil(filtered.length / dotsPerRow);
          let lastRowInCol = totalRows - 1;
          while (lastRowInCol * dotsPerRow + prevCol >= filtered.length) lastRowInCol--;
          newIdx = lastRowInCol * dotsPerRow + prevCol;
        }
        if (newIdx === currentIdx) return;
      }

      e.preventDefault();
      serveQuestion(filtered[newIdx]);
    }
  });
}

function openChapterModal(ch) {
  const modal = document.getElementById('chapter-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = `Chapter ${ch}: ${CHAPTER_NAMES[ch] || ''}`;

  const chapItems = allItems.filter(i => i.chapter === ch);

  let html = `<table class="chapter-table">
    <thead>
      <tr>
        <th>Status</th>
        <th>Type</th>
        <th>#</th>
        <th>Statement</th>
      </tr>
    </thead>
    <tbody>`;

  chapItems.forEach(item => {
    const bucket = buckets[item.id] || 'unseen';
    const displayType = getDisplayType(item);
    const origType = capitalizeFirst(getOriginalType(item));
    const typeClass = displayType === 'definition' ? 'type-def' : 'type-result';

    let stText = item.statement;
    stText = processTextFormatting(stText);
    stText = stText.replace(/\n/g, '<br>');

    const nameStr = item.name ? ` (${item.name})` : '';

    html += `
      <tr data-pdf-page="${item.pdfPage}">
        <td class="status-cell"><span class="status-dot ${bucket}"></span></td>
        <td class="type-cell ${typeClass}">${origType}</td>
        <td style="white-space:nowrap; font-weight:600;">${item.number}${nameStr}</td>
        <td class="statement-cell">${stText}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  body.innerHTML = html;

  // Render KaTeX in the table
  renderMathInElement(body, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  });

  // Click a row → navigate PDF to that page
  body.querySelectorAll('tr[data-pdf-page]').forEach(row => {
    row.addEventListener('click', () => {
      const page = parseInt(row.dataset.pdfPage);
      navigatePDF(page);
      closeModal();
    });
  });

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('chapter-modal').classList.add('hidden');
}

// ===== Mode Toggle =====
function setupModeToggle() {
  const toggle = document.getElementById('mode-toggle');
  const timeline = document.getElementById('timeline-strip');

  toggle.addEventListener('click', () => {
    sequentialMode = !sequentialMode;
    sequentialIndex = 0;
    toggle.textContent = sequentialMode ? 'In Order' : 'Random';
    toggle.classList.toggle('active', sequentialMode);

    renderTimeline();
  });
}

let timelineFiltered = []; // cache for arrow nav

function renderTimeline(fullRebuild) {
  const track = document.getElementById('timeline-track');
  const position = document.getElementById('timeline-position');
  const filtered = getFilteredItems();
  timelineFiltered = filtered;

  const currentIdx = currentItem ? filtered.findIndex(item => item.id === currentItem.id) : -1;
  position.textContent = `${currentIdx >= 0 ? currentIdx + 1 : '–'} / ${filtered.length}`;

  // If not a full rebuild, just update classes on existing dots
  if (!fullRebuild && track.children.length === filtered.length) {
    Array.from(track.children).forEach((dot, i) => {
      const item = filtered[i];
      const bucket = buckets[item.id] || 'unseen';
      dot.className = 'tl-dot ' + bucket;
      if (currentItem && item.id === currentItem.id) {
        dot.classList.add('current');
      }
    });
    return;
  }

  // Full rebuild
  track.innerHTML = '';
  filtered.forEach((item, i) => {
    const dot = document.createElement('button');
    dot.className = 'tl-dot';
    const bucket = buckets[item.id] || 'unseen';
    dot.classList.add(bucket);
    if (currentItem && item.id === currentItem.id) {
      dot.classList.add('current');
    }

    const label = `${item.number}${item.name ? ' — ' + item.name : ''}`;
    dot.title = label;

    dot.addEventListener('click', () => {
      serveQuestion(item);
    });

    dot.addEventListener('mouseenter', () => {
      if (currentItem && item.id === currentItem.id) return;
      previewItem(item);
    });

    dot.addEventListener('mouseleave', () => {
      if (currentItem) showItemOnCard(currentItem);
    });

    track.appendChild(dot);
  });
}

// ===== Export CSV =====
function setupExport() {
  document.getElementById('export-csv').addEventListener('click', () => {
    const headers = ['Number', 'Type', 'Chapter', 'Section', 'Name', 'Statement'];
    const escapeCSV = (str) => {
      if (!str) return '';
      str = String(str);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = allItems.map(item => [
      item.number,
      capitalizeFirst(item.type),
      item.chapter,
      item.section,
      item.name || '',
      item.statement
    ].map(escapeCSV).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'math281_theorems_definitions.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ===== Theorem Database =====
function setupDatabase() {
  const openBtn = document.getElementById('open-database');
  const modal = document.getElementById('database-modal');
  const closeBtn = document.getElementById('database-close');
  const searchInput = document.getElementById('database-search');

  openBtn.addEventListener('click', () => {
    searchInput.value = '';
    renderDatabase('');
    modal.classList.remove('hidden');
    setTimeout(() => searchInput.focus(), 100);
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  searchInput.addEventListener('input', () => {
    renderDatabase(searchInput.value.trim());
  });
}

function renderDatabase(query) {
  const body = document.getElementById('database-body');
  const lowerQuery = query.toLowerCase();

  const filtered = query === '' ? allItems : allItems.filter(item => {
    const searchable = [
      item.number,
      item.type,
      item.name || '',
      item.statement,
      `${item.chapter}`,
      item.section
    ].join(' ').toLowerCase();

    // Split query into words, all must match
    const words = lowerQuery.split(/\s+/);
    return words.every(w => searchable.includes(w));
  });

  if (filtered.length === 0) {
    body.innerHTML = '<div class="db-no-results">No results found.</div>';
    return;
  }

  let html = '';
  let currentChapter = null;

  filtered.forEach(item => {
    if (item.chapter !== currentChapter) {
      currentChapter = item.chapter;
      html += `<div class="db-chapter-heading">Chapter ${currentChapter}: ${CHAPTER_NAMES[currentChapter] || ''}</div>`;
    }

    const typeName = capitalizeFirst(item.type);
    const typeClass = item.type === 'definition' ? 'type-def' : 'type-result';

    let nameHtml;
    if (item.name) {
      nameHtml = `<span class="db-item-name">${item.name}</span>`;
    } else {
      // Show the raw statement verbatim, truncated with ...
      const preview = item.statement
        .replace(/\n/g, ' ')
        .slice(0, 100);
      nameHtml = `<span class="db-item-preview">${preview}...</span>`;
    }

    html += `<div class="db-item" data-pdf-page="${item.pdfPage}">
      <span class="db-item-number">${item.number}</span>
      <span class="db-item-type ${typeClass}">${typeName}</span>
      ${nameHtml}
    </div>`;
  });

  body.innerHTML = html;

  renderMathInElement(body, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  });

  body.querySelectorAll('.db-item').forEach(row => {
    row.addEventListener('click', () => {
      const page = parseInt(row.dataset.pdfPage);
      navigatePDF(page);
      document.getElementById('database-modal').classList.add('hidden');
    });
  });
}

// ===== Landing Screen =====
function setupLanding() {
  const landing = document.getElementById('landing-screen');
  const wrapper = document.getElementById('landing-prof-wrapper');

  const seenIntro = localStorage.getItem('realanalysis_seen_intro');

  landing.addEventListener('click', () => {
    wrapper.classList.add('spinning');

    wrapper.addEventListener('animationend', () => {
      landing.classList.add('fade-out');

      setTimeout(() => {
        landing.remove();
        if (!seenIntro) {
          document.getElementById('how-it-works-overlay').classList.remove('hidden');
          localStorage.setItem('realanalysis_seen_intro', '1');
        }
      }, 500);
    }, { once: true });
  });
}

function setupHelpBtn() {
  const helpBtn = document.getElementById('help-btn');
  const overlay = document.getElementById('how-it-works-overlay');
  const dismissBtn = document.getElementById('how-it-works-dismiss');

  helpBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
  });

  dismissBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
}

// ===== Name & Sync =====
function setupNamePrompt() {
  const modal = document.getElementById('name-modal');
  const input = document.getElementById('name-input');
  const submit = document.getElementById('name-submit');

  if (!userName) {
    // Show name prompt immediately (on top of landing screen if needed)
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 300);
  }

  const saveName = () => {
    const name = input.value.trim();
    if (!name) return;
    userName = name;
    localStorage.setItem(NAME_STORAGE_KEY, userName);
    if (BANNED_USERS.includes(userName.toLowerCase())) {
      location.reload();
      return;
    }
    modal.classList.add('hidden');
    pendingPush = true;
    actuallyPushNow();
  };

  submit.addEventListener('click', saveName);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveName();
  });
}

let lastPushedBuckets = '';
let pendingPush = false;

function pushProgress() {
  if (!userName) return;
  // Only push if something actually changed
  const current = JSON.stringify(buckets);
  if (current === lastPushedBuckets) return;
  // Debounce — mark dirty and let the interval handle it
  pendingPush = true;
}

function actuallyPushNow() {
  if (!userName || !pendingPush) return;
  const current = JSON.stringify(buckets);
  if (current === lastPushedBuckets) {
    pendingPush = false;
    return;
  }
  lastPushedBuckets = current;
  pendingPush = false;
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: userName, buckets })
  }).catch(() => {});
}

function startSync() {
  // Push at most once every 60 seconds, only if dirty
  syncInterval = setInterval(() => {
    actuallyPushNow();
  }, 60000);

  // Also push on tab close
  window.addEventListener('beforeunload', () => {
    if (pendingPush && userName) {
      navigator.sendBeacon('/api/progress',
        new Blob([JSON.stringify({ name: userName, buckets })], { type: 'application/json' })
      );
    }
  });
}

function setupLeaderboard() {
  const openBtn = document.getElementById('open-leaderboard');
  const modal = document.getElementById('leaderboard-modal');
  const closeBtn = document.getElementById('leaderboard-close');

  openBtn.addEventListener('click', async () => {
    modal.classList.remove('hidden');
    document.getElementById('leaderboard-body').innerHTML = '<div class="db-no-results">Loading...</div>';

    try {
      const res = await fetch('/api/progress');
      const users = await res.json();

      // Sort by most seen
      users.sort((a, b) => b.seen - a.seen);

      const body = document.getElementById('leaderboard-body');
      if (users.length === 0) {
        body.innerHTML = '<div class="db-no-results">No one has synced yet!</div>';
        return;
      }

      const CHEATERS = ['alex'];
      const legit = users.filter(u => !CHEATERS.includes(u.name.toLowerCase()));
      const cheaters = users.filter(u => CHEATERS.includes(u.name.toLowerCase()));
      leaderboardUsers = legit.concat(cheaters);
      renderLeaderboardList(body, legit, cheaters);
    } catch(e) {
      document.getElementById('leaderboard-body').innerHTML = '<div class="db-no-results">Could not load progress.</div>';
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

let leaderboardUsers = [];

function renderLeaderboardList(body, users, cheaters) {
  let html = users.map((u, i) => `
    <div class="lb-row lb-clickable" data-user-idx="${i}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${u.name}</span>
      <div class="lb-stats">
        <span class="lb-chip green">${u.green}</span>
        <span class="lb-chip yellow">${u.yellow}</span>
        <span class="lb-chip red">${u.red}</span>
      </div>
      <span class="lb-seen">${u.seen} / ${u.total}</span>
    </div>
  `).join('');

  if (cheaters && cheaters.length > 0) {
    html += `<div class="lb-cheaters-header">Cheaters</div>`;
    html += cheaters.map((u, i) => `
      <div class="lb-row lb-clickable lb-cheater" data-user-idx="${users.length + i}">
        <span class="lb-rank">×</span>
        <span class="lb-name">${u.name}</span>
        <div class="lb-stats">
          <span class="lb-chip green">${u.green}</span>
          <span class="lb-chip yellow">${u.yellow}</span>
          <span class="lb-chip red">${u.red}</span>
        </div>
        <span class="lb-seen">${u.seen} / ${u.total}</span>
      </div>
    `).join('');
  }

  body.innerHTML = html;

  body.querySelectorAll('.lb-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.userIdx);
      renderUserProfile(body, leaderboardUsers[idx]);
    });
  });
}

function renderUserProfile(body, user) {
  const userBuckets = user.buckets || {};

  let html = `<div class="lb-profile-header">
    <button class="lb-back">&larr; Back</button>
    <span class="lb-profile-name">${user.name}</span>
    <div class="lb-stats">
      <span class="lb-chip green">${user.green}</span>
      <span class="lb-chip yellow">${user.yellow}</span>
      <span class="lb-chip red">${user.red}</span>
      <span class="lb-seen">${user.seen} / ${user.total}</span>
    </div>
  </div>`;

  for (let ch = 1; ch <= 7; ch++) {
    const chapItems = allItems.filter(i => i.chapter === ch);
    if (chapItems.length === 0) continue;

    const chGreen = chapItems.filter(i => userBuckets[i.id] === 'green').length;
    const chYellow = chapItems.filter(i => userBuckets[i.id] === 'yellow').length;
    const chRed = chapItems.filter(i => userBuckets[i.id] === 'red').length;
    const chTotal = chapItems.length;

    html += `<div class="lb-chapter">
      <div class="lb-chapter-header">
        <span class="lb-chapter-title">Ch ${ch}: ${CHAPTER_NAMES[ch]}</span>
        <span class="lb-chapter-count">${chGreen + chYellow + chRed}/${chTotal}</span>
      </div>
      <div class="lb-chapter-bar">
        <div class="chapter-bar-fill-green" style="width: ${(chGreen / chTotal) * 100}%"></div>
        <div class="chapter-bar-fill-yellow" style="width: ${(chYellow / chTotal) * 100}%"></div>
        <div class="chapter-bar-fill-red" style="width: ${(chRed / chTotal) * 100}%"></div>
      </div>
      <div class="lb-chapter-items">`;

    chapItems.forEach(item => {
      const bucket = userBuckets[item.id] || 'unseen';
      const origType = capitalizeFirst(item.type);
      const typeClass = item.type === 'definition' ? 'type-def' : 'type-result';
      const nameStr = item.name ? item.name : '';

      html += `<div class="lb-item">
        <span class="status-dot ${bucket}"></span>
        <span class="lb-item-num">${item.number}</span>
        <span class="lb-item-type ${typeClass}">${origType}</span>
        <span class="lb-item-name">${nameStr}</span>
      </div>`;
    });

    html += `</div></div>`;
  }

  body.innerHTML = html;

  body.querySelector('.lb-back').addEventListener('click', () => {
    renderLeaderboardList(body, leaderboardUsers);
  });
}

// ===== Version Check =====
const CURRENT_VERSION = 6;
function startVersionCheck() {
  // Track reload attempts to break infinite loops from cache
  const reloadKey = 'realanalysis_last_reload';
  const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0');
  const now = Date.now();
  // If we just reloaded in the last 60s, don't try again
  const justReloaded = now - lastReload < 60000;

  setInterval(async () => {
    try {
      const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (data.v > CURRENT_VERSION && !justReloaded) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        // Hard reload bypassing cache
        location.reload();
      }
    } catch(e) {}
  }, 30000);
}

// ===== Card Display =====
function showItemOnCard(item) {
  const badge = document.getElementById('question-type-badge');
  const label = document.getElementById('question-label');
  const statement = document.getElementById('question-statement');

  const displayType = getDisplayType(item);
  badge.textContent = displayType;
  badge.className = `badge-${displayType}`;

  const origType = capitalizeFirst(getOriginalType(item));
  const name = item.name ? ` — ${item.name}` : '';
  label.textContent = `${origType} ${item.number}${name} (Section ${item.section})`;

  if (item.type === 'definition') {
    const defName = item.name || `Definition ${item.number}`;
    statement.innerHTML = `<em>State the definition of <strong>${defName}</strong>.</em>`;
  } else {
    let text = item.statement;
    text = processTextFormatting(text);
    text = text.replace(/\n/g, '<br>');
    statement.innerHTML = text;

    renderMathInElement(statement, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }
}

function previewItem(item) {
  const badge = document.getElementById('question-type-badge');
  const label = document.getElementById('question-label');
  const statement = document.getElementById('question-statement');
  const card = document.getElementById('question-card');

  const displayType = getDisplayType(item);
  badge.textContent = displayType;
  badge.className = `badge-${displayType}`;

  const origType = capitalizeFirst(getOriginalType(item));
  const name = item.name ? ` — ${item.name}` : '';
  label.textContent = `${origType} ${item.number}${name} (Section ${item.section})`;

  // Always show full statement for preview (even definitions)
  let text = item.statement;
  text = processTextFormatting(text);
  text = text.replace(/\n/g, '<br>');
  statement.innerHTML = text;

  renderMathInElement(statement, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  });

  card.classList.remove('hidden');
}

// ===== Helpers =====
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function processTextFormatting(text) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return part;
    }
    part = part.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    part = part.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    return part;
  }).join('');
}
