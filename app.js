// ===== State =====
const STORAGE_KEY = 'realanalysis_buckets';
const FILTER_STORAGE_KEY = 'realanalysis_filters';
let allItems = [];
let currentItem = null;
let buckets = {}; // { itemId: 'green' | 'yellow' | 'red' }

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
  setupLanding();
  setupHelpBtn();
  updateStats();
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

function serveQuestion() {
  const filtered = getFilteredItems();

  if (filtered.length === 0) {
    showNoQuestions();
    return;
  }

  const idx = Math.floor(Math.random() * filtered.length);
  currentItem = filtered[idx];

  const card = document.getElementById('question-card');
  const badge = document.getElementById('question-type-badge');
  const label = document.getElementById('question-label');
  const statement = document.getElementById('question-statement');
  const openBtn = document.getElementById('open-in-notes');

  // Type badge
  const displayType = getDisplayType(currentItem);
  badge.textContent = displayType;
  badge.className = `badge-${displayType}`;

  // Label: show original type (e.g. "Theorem 2.15 — Bolzano-Weierstrass")
  const origType = capitalizeFirst(getOriginalType(currentItem));
  const name = currentItem.name ? ` — ${currentItem.name}` : '';
  label.textContent = `${origType} ${currentItem.number}${name} (Section ${currentItem.section})`;

  // For definitions: show prompt instead of full statement
  if (currentItem.type === 'definition') {
    const name = currentItem.name || `Definition ${currentItem.number}`;
    statement.innerHTML = `<em>State the definition of <strong>${name}</strong>.</em>`;
  } else {
    let text = currentItem.statement;
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

  // "Open in Notes" button — only navigates PDF on click
  openBtn.onclick = () => navigatePDF(currentItem.pdfPage);

  card.classList.remove('hidden');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';

  document.getElementById('bucket-buttons').classList.remove('hidden');
  document.getElementById('prof-prompt').textContent = 'Click for another!';
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
  newViewer.src = `281_notes.pdf#page=${pdfPage}&view=Fit`;
  parent.replaceChild(newViewer, viewer);
}

// ===== Bucket Buttons =====
function setupBucketButtons() {
  document.getElementById('btn-green').addEventListener('click', () => bucketCurrent('green'));
  document.getElementById('btn-yellow').addEventListener('click', () => bucketCurrent('yellow'));
  document.getElementById('btn-red').addEventListener('click', () => bucketCurrent('red'));
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
