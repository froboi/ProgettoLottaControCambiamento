// =============================================================
//  CO₂ FAMILIARE – app.js
//  Logica completa: form, calcolo, grafici, AI, storage, PDF
// =============================================================

"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COSTANTI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const EMISSION_FACTORS = {         // g CO₂ per km
  benzina:  170,
  diesel:   150,
  ibrida:    90,
  elettrica: 47,
  moto:     110,
  treno:     14,
  metro:     30,
  autobus:   68,
  bicicletta:  0,
  piedi:       0,
};

const TRANSPORT_LABELS = {
  benzina:    '🚗 Auto benzina',
  diesel:     '🚙 Auto diesel',
  ibrida:     '🔋 Auto ibrida',
  elettrica:  '⚡ Auto elettrica',
  moto:       '🏍️ Moto',
  treno:      '🚆 Treno',
  metro:      '🚇 Metro',
  autobus:    '🚌 Autobus',
  bicicletta: '🚲 Bicicletta',
  piedi:      '🚶 A piedi',
};

const PERSONAL_VEHICLES  = ['benzina','diesel','ibrida','elettrica','moto'];
const PUBLIC_VEHICLES    = ['treno','metro','autobus'];
const ECO_VEHICLES       = ['bicicletta','piedi'];
const MOTORIZED_PERSONAL = ['benzina','diesel','ibrida','elettrica','moto'];

const WORKING_DAYS_YEAR  = 220;
const WORKING_DAYS_MONTH = Math.round(WORKING_DAYS_YEAR / 12);

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = 'phi3';

const SYSTEM_PROMPT =
  'Sei un assistente educativo esperto di sostenibilità ambientale e ' +
  'riduzione delle emissioni di CO₂. Fornisci solo consigli pratici, ' +
  'chiari e didattici. Rispondi SOLO a domande inerenti sostenibilità, ' +
  'mobilità sostenibile e riduzione CO₂. Per qualsiasi altro argomento ' +
  'rispondi: "Posso aiutarti solo su temi di sostenibilità e mobilità."';

// Dati globali
let familyData  = [];   // risultato del form
let resultsData = [];   // calcolato

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TEMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function initTheme() {
  const saved = localStorage.getItem('co2_theme') || 'light';
  setTheme(saved);
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('co2_theme', theme);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ GENERAZIONE FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function generateMembersForm(n) {
  const container = document.getElementById('members-container');
  container.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const card = createMemberCard(i, n);
    container.appendChild(card);
  }

  // Mostra CTA calcola
  document.getElementById('cta-calcola').classList.remove('hidden');

  // Aggiorna selezione membri condivisi ogni volta che un nome cambia
  container.querySelectorAll('.member-name-input').forEach(inp => {
    inp.addEventListener('input', updateSharedMemberSelectors);
  });

  // Carica dati salvati se esistenti
  loadSavedFormData();
}

function createMemberCard(index, total) {
  const card = document.createElement('div');
  card.className = 'member-card';
  card.id = `member-${index}`;

  card.innerHTML = `
    <div class="member-header">
      <span class="member-number">Membro ${index + 1}</span>
    </div>

    <div class="member-name-row">
      <label for="name-${index}">Nome:</label>
      <input type="text" id="name-${index}" class="member-name-input"
             data-index="${index}" placeholder="es. Mario" autocomplete="off" />
    </div>

    <!-- Tabs Andata / Ritorno -->
    <div class="direction-tabs">
      <button class="dir-tab active" data-index="${index}" data-dir="andata">↗️ Andata</button>
      <button class="dir-tab"       data-index="${index}" data-dir="ritorno">↩️ Ritorno</button>
    </div>

    <!-- Pannello Andata -->
    <div class="direction-panel active" id="panel-${index}-andata">
      ${buildDirectionPanel(index, 'andata')}
    </div>

    <!-- Pannello Ritorno -->
    <div class="direction-panel" id="panel-${index}-ritorno">
      ${buildDirectionPanel(index, 'ritorno')}
    </div>
  `;

  // Event listeners
  setupCardEvents(card, index);
  return card;
}

function buildDirectionPanel(mIdx, dir) {
  return `
    <!-- Categoria trasporto -->
    <div class="transport-categories">
      <button class="cat-btn selected" data-midx="${mIdx}" data-dir="${dir}" data-cat="personale">🚗 Personale</button>
      <button class="cat-btn"         data-midx="${mIdx}" data-dir="${dir}" data-cat="pubblico" >🚆 Pubblico</button>
      <button class="cat-btn"         data-midx="${mIdx}" data-dir="${dir}" data-cat="ecologico">🌿 Ecologico</button>
    </div>

    <!-- Opzioni trasporto personale -->
    <div class="transport-options" id="opts-personale-${mIdx}-${dir}">
      ${PERSONAL_VEHICLES.map(v => `
        <label class="transport-option ${v==='benzina'?'selected':''}">
          <input type="radio" name="transport-${mIdx}-${dir}" value="${v}" ${v==='benzina'?'checked':''}>
          ${TRANSPORT_LABELS[v]}
        </label>`).join('')}
    </div>

    <!-- Opzioni trasporto pubblico (hidden) -->
    <div class="transport-options hidden" id="opts-pubblico-${mIdx}-${dir}">
      ${PUBLIC_VEHICLES.map(v => `
        <label class="transport-option">
          <input type="checkbox" name="pub-${mIdx}-${dir}-${v}" value="${v}" class="pub-check">
          ${TRANSPORT_LABELS[v]}
        </label>`).join('')}
    </div>
    <!-- km per ogni mezzo pubblico selezionato -->
    <div id="pub-km-rows-${mIdx}-${dir}"></div>

    <!-- Opzioni ecologico (hidden) -->
    <div class="transport-options hidden" id="opts-ecologico-${mIdx}-${dir}">
      ${ECO_VEHICLES.map(v => `
        <label class="transport-option ${v==='bicicletta'?'':''}">
          <input type="radio" name="transport-eco-${mIdx}-${dir}" value="${v}">
          ${TRANSPORT_LABELS[v]}
        </label>`).join('')}
    </div>

    <!-- Km totali (per personale / ecologico) -->
    <div class="km-row" id="km-main-row-${mIdx}-${dir}">
      <label for="km-${mIdx}-${dir}">Distanza (km):</label>
      <input type="number" id="km-${mIdx}-${dir}" class="km-input" min="0.1" max="1000" step="0.1" placeholder="km" value="10" />
      <span class="hint">km per singolo tragitto</span>
    </div>

    <!-- Viaggio condiviso (solo personale) -->
    <div class="shared-ride-section" id="shared-${mIdx}-${dir}">
      <label class="shared-ride-toggle">
        <input type="checkbox" id="shared-check-${mIdx}-${dir}" class="shared-check" data-midx="${mIdx}" data-dir="${dir}" />
        🤝 Viaggio condiviso
      </label>
      <div class="shared-ride-details hidden" id="shared-details-${mIdx}-${dir}">
        <div>
          <label>Numero di persone nel veicolo (incluso te):</label>
          <input type="number" id="shared-n-${mIdx}-${dir}" min="2" max="10" value="2" style="width:70px" />
        </div>
        <div>
          <label>Membri coinvolti:</label>
          <div class="members-checkboxes" id="shared-members-${mIdx}-${dir}"></div>
        </div>
        <div class="km-row">
          <label for="shared-km-${mIdx}-${dir}">Km percorsi insieme:</label>
          <input type="number" id="shared-km-${mIdx}-${dir}" class="km-input" min="0.1" max="1000" step="0.1" placeholder="km" />
        </div>
        <div>
          <label>Dopo il viaggio condiviso, tu prosegui separatamente?</label>
          <div class="radio-group">
            <label><input type="radio" name="prosegui-${mIdx}-${dir}" value="no" checked> No</label>
            <label><input type="radio" name="prosegui-${mIdx}-${dir}" value="si"> Sì</label>
          </div>
        </div>
        <div class="km-row hidden" id="sep-km-row-${mIdx}-${dir}">
          <label for="sep-km-${mIdx}-${dir}">Km separati (solo tu):</label>
          <input type="number" id="sep-km-${mIdx}-${dir}" class="km-input" min="0.1" max="1000" step="0.1" placeholder="km" />
        </div>
      </div>
    </div>
  `;
}

function setupCardEvents(card, mIdx) {
  // Tab switching
  card.querySelectorAll('.dir-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const dir = tab.dataset.dir;
      card.querySelectorAll('.dir-tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.direction-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      card.querySelector(`#panel-${mIdx}-${dir}`).classList.add('active');
    });
  });

  // Category buttons
  card.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      const cat = btn.dataset.cat;
      // aggiorna bottoni
      card.querySelectorAll(`.cat-btn[data-dir="${dir}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // mostra/nascondi opzioni
      switchCategory(card, mIdx, dir, cat);
    });
  });

  // Transport option clicks (personale = radio)
  ['andata','ritorno'].forEach(dir => {
    const personalOpts = card.querySelector(`#opts-personale-${mIdx}-${dir}`);
    if (personalOpts) {
      personalOpts.querySelectorAll('.transport-option').forEach(opt => {
        opt.addEventListener('click', () => {
          personalOpts.querySelectorAll('.transport-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) {
          radio.addEventListener('change', () => {
            personalOpts.querySelectorAll('.transport-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
          });
        }
      });
    }

    const ecoOpts = card.querySelector(`#opts-ecologico-${mIdx}-${dir}`);
    if (ecoOpts) {
      ecoOpts.querySelectorAll('.transport-option').forEach(opt => {
        opt.addEventListener('click', () => {
          ecoOpts.querySelectorAll('.transport-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });
    }

    // Public transport checkboxes → km fields
    const pubOpts = card.querySelector(`#opts-pubblico-${mIdx}-${dir}`);
    if (pubOpts) {
      pubOpts.querySelectorAll('.pub-check').forEach(cb => {
        cb.addEventListener('change', () => updatePublicKmRows(card, mIdx, dir));
        const opt = cb.closest('.transport-option');
        cb.addEventListener('change', () => {
          if (cb.checked) opt.classList.add('selected');
          else opt.classList.remove('selected');
        });
      });
    }

    // Shared ride toggle
    const sharedCheck = card.querySelector(`#shared-check-${mIdx}-${dir}`);
    if (sharedCheck) {
      sharedCheck.addEventListener('change', () => {
        const details = card.querySelector(`#shared-details-${mIdx}-${dir}`);
        details.classList.toggle('hidden', !sharedCheck.checked);
        updateSharedMemberSelectors();
      });
    }

    // Proseguimento separato
    card.querySelectorAll(`input[name="prosegui-${mIdx}-${dir}"]`).forEach(r => {
      r.addEventListener('change', () => {
        const sepKmRow = card.querySelector(`#sep-km-row-${mIdx}-${dir}`);
        if (sepKmRow) sepKmRow.classList.toggle('hidden', r.value !== 'si');
      });
    });
  });
}

function switchCategory(card, mIdx, dir, cat) {
  const panels = ['personale','pubblico','ecologico'];
  panels.forEach(p => {
    const el = card.querySelector(`#opts-${p}-${mIdx}-${dir}`);
    if (el) el.classList.add('hidden');
  });
  card.querySelector(`#opts-${cat}-${mIdx}-${dir}`).classList.remove('hidden');

  // km principale visibile solo per personale ed ecologico
  const kmRow = card.querySelector(`#km-main-row-${mIdx}-${dir}`);
  if (kmRow) kmRow.classList.toggle('hidden', cat === 'pubblico');

  // pub-km-rows visibile solo per pubblico
  const pubKmRows = card.querySelector(`#pub-km-rows-${mIdx}-${dir}`);
  if (pubKmRows) pubKmRows.classList.toggle('hidden', cat !== 'pubblico');

  // viaggio condiviso solo per personale con mezzi motorizzati
  const sharedSection = card.querySelector(`#shared-${mIdx}-${dir}`);
  if (sharedSection) sharedSection.classList.toggle('hidden', cat !== 'personale');
}

function updatePublicKmRows(card, mIdx, dir) {
  const container = card.querySelector(`#pub-km-rows-${mIdx}-${dir}`);
  if (!container) return;
  const checked = [...card.querySelectorAll(`#opts-pubblico-${mIdx}-${dir} .pub-check`)].filter(c => c.checked);
  container.innerHTML = checked.length ? '<div style="margin-top:0.5rem">' +
    checked.map(c => `
      <div class="km-row" style="margin-bottom:0.4rem">
        <label>${TRANSPORT_LABELS[c.value]}:</label>
        <input type="number" id="pub-km-${mIdx}-${dir}-${c.value}" class="km-input"
               min="0.1" max="1000" step="0.1" placeholder="km" value="5" />
        <span class="hint">km</span>
      </div>`).join('') + '</div>' : '';
}

function updateSharedMemberSelectors() {
  const n = parseInt(document.getElementById('num-members').value) || 0;
  const names = [];
  for (let i = 0; i < n; i++) {
    const inp = document.getElementById(`name-${i}`);
    names.push({ index: i, name: inp ? (inp.value.trim() || `Membro ${i+1}`) : `Membro ${i+1}` });
  }

  for (let i = 0; i < n; i++) {
    ['andata','ritorno'].forEach(dir => {
      const box = document.getElementById(`shared-members-${i}-${dir}`);
      if (!box) return;
      box.innerHTML = names.filter(m => m.index !== i).map(m => `
        <label>
          <input type="checkbox" name="smem-${i}-${dir}" value="${m.index}">
          ${m.name}
        </label>`).join('');
    });
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RACCOLTA DATI FORM ━━━━━━━━━━━━━━━━━━━━━━━━━ */

function getActiveCategory(mIdx, dir) {
  const btn = document.querySelector(`.cat-btn.selected[data-midx="${mIdx}"][data-dir="${dir}"]`);
  return btn ? btn.dataset.cat : 'personale';
}

function getDirectionData(mIdx, dir) {
  const cat = getActiveCategory(mIdx, dir);
  const segments = [];

  if (cat === 'personale') {
    const radio = document.querySelector(`input[name="transport-${mIdx}-${dir}"]:checked`);
    const mezzo = radio ? radio.value : 'benzina';
    const kmEl  = document.getElementById(`km-${mIdx}-${dir}`);
    const km    = parseFloat(kmEl ? kmEl.value : 0) || 0;

    // Viaggio condiviso
    const sharedCheck = document.getElementById(`shared-check-${mIdx}-${dir}`);
    const isShared = sharedCheck && sharedCheck.checked;

    if (isShared) {
      const sharedKm = parseFloat(document.getElementById(`shared-km-${mIdx}-${dir}`)?.value) || 0;
      const nPersone = parseInt(document.getElementById(`shared-n-${mIdx}-${dir}`)?.value) || 2;
      const proseguiEl = document.querySelector(`input[name="prosegui-${mIdx}-${dir}"]:checked`);
      const prosegui = proseguiEl ? proseguiEl.value : 'no';
      const sepKm = prosegui === 'si'
        ? (parseFloat(document.getElementById(`sep-km-${mIdx}-${dir}`)?.value) || 0)
        : 0;

      const memChecked = [...document.querySelectorAll(`input[name="smem-${mIdx}-${dir}"]:checked`)].map(c => parseInt(c.value));

      segments.push({ mezzo, km: sharedKm, shared: true, nPersone, membriCoinvolti: memChecked });
      if (sepKm > 0) segments.push({ mezzo, km: sepKm, shared: false, nPersone: 1 });
    } else {
      segments.push({ mezzo, km, shared: false, nPersone: 1 });
    }

  } else if (cat === 'pubblico') {
    const checked = [...document.querySelectorAll(`#opts-pubblico-${mIdx}-${dir} .pub-check`)].filter(c => c.checked);
    checked.forEach(c => {
      const kmEl = document.getElementById(`pub-km-${mIdx}-${dir}-${c.value}`);
      const km = parseFloat(kmEl ? kmEl.value : 0) || 0;
      segments.push({ mezzo: c.value, km, shared: false, nPersone: 1 });
    });
    if (segments.length === 0) segments.push({ mezzo: 'autobus', km: 0, shared: false, nPersone: 1 });

  } else { // ecologico
    const radio = document.querySelector(`input[name="transport-eco-${mIdx}-${dir}"]:checked`);
    const mezzo = radio ? radio.value : 'bicicletta';
    const kmEl  = document.getElementById(`km-${mIdx}-${dir}`);
    const km    = parseFloat(kmEl ? kmEl.value : 0) || 0;
    segments.push({ mezzo, km, shared: false, nPersone: 1 });
  }

  return { cat, segments };
}

function collectFormData() {
  const n = parseInt(document.getElementById('num-members').value) || 0;
  const data = [];
  for (let i = 0; i < n; i++) {
    const nameEl = document.getElementById(`name-${i}`);
    const nome = nameEl ? (nameEl.value.trim() || `Membro ${i+1}`) : `Membro ${i+1}`;
    data.push({
      index: i,
      nome,
      andata:  getDirectionData(i, 'andata'),
      ritorno: getDirectionData(i, 'ritorno'),
    });
  }
  return data;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ VALIDAZIONE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function validateData(data) {
  const errors = [];
  data.forEach((member, i) => {
    ['andata','ritorno'].forEach(dir => {
      const ddir = member[dir];
      ddir.segments.forEach(seg => {
        if (seg.km < 0) errors.push(`${member.nome}: km negativi in ${dir}`);
        if (seg.km > 1500) errors.push(`${member.nome}: valore km irrealistico in ${dir} (max 1500 km)`);
        if (ddir.cat !== 'ecologico' && seg.km === 0 && !seg.shared) {
          // Solo warning, non blocco
        }
      });
    });
  });
  return errors;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CALCOLO EMISSIONI ━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Calcola le emissioni per giorno (g CO₂) di un membro.
 * Tiene conto dei viaggi condivisi: divide le emissioni per il numero di persone.
 */
function calcMemberDailyEmissions(member) {
  let totalG = 0;
  const breakdown = {};   // per mezzo: g CO₂

  ['andata','ritorno'].forEach(dir => {
    member[dir].segments.forEach(seg => {
      if (seg.km <= 0) return;
      const factor = EMISSION_FACTORS[seg.mezzo] ?? 0;
      const rawG = factor * seg.km;
      // Se condiviso, dividi per numero di persone nel veicolo
      const gPerPerson = seg.shared ? rawG / seg.nPersone : rawG;

      totalG += gPerPerson;
      breakdown[seg.mezzo] = (breakdown[seg.mezzo] || 0) + gPerPerson;
    });
  });

  return { dailyG: totalG, breakdown };
}

function calculateEmissions(member) {
  const { dailyG, breakdown } = calcMemberDailyEmissions(member);
  return {
    nome:       member.nome,
    dailyG,
    dailyKg:    dailyG / 1000,
    monthlyKg:  dailyG / 1000 * WORKING_DAYS_MONTH,
    yearlyKg:   dailyG / 1000 * WORKING_DAYS_YEAR,
    breakdown,  // mezzo → g/giorno
    andata:     member.andata,
    ritorno:    member.ritorno,
  };
}

function calculateFamily(data) {
  const memberResults = data.map(calculateEmissions);
  const totalYearlyKg = memberResults.reduce((s, m) => s + m.yearlyKg, 0);
  const totalMonthlyKg = memberResults.reduce((s, m) => s + m.monthlyKg, 0);

  // Breakdown familiare (per mezzo)
  const famBreakdown = {};
  memberResults.forEach(m => {
    Object.entries(m.breakdown).forEach(([mezzo, g]) => {
      famBreakdown[mezzo] = (famBreakdown[mezzo] || 0) + g;
    });
  });

  return { memberResults, totalYearlyKg, totalMonthlyKg, famBreakdown };
}

function impactLevel(yearlyKgPerPerson) {
  // Media europea spostamenti: ~700 kg/anno
  if (yearlyKgPerPerson < 400)  return 'good';
  if (yearlyKgPerPerson < 900)  return 'medium';
  return 'bad';
}
function impactLabel(level) {
  return { good: '🟢 Basso', medium: '🟡 Medio', high: '🔴 Elevato', bad: '🔴 Elevato' }[level] || '';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RISULTATI UI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function showResults(results) {
  document.getElementById('page-input').classList.add('hidden');
  const rPage = document.getElementById('page-results');
  rPage.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const { memberResults, totalYearlyKg, totalMonthlyKg } = results;
  const nMembers = memberResults.length;
  const avgYearly = totalYearlyKg / nMembers;

  // Subtitle
  document.getElementById('results-subtitle').textContent =
    `Analisi per ${nMembers} membro${nMembers > 1 ? ' del nucleo familiare' : ''}`;

  // Summary cards
  const summaryGrid = document.getElementById('summary-cards');
  const level = impactLevel(avgYearly);
  summaryGrid.innerHTML = `
    <div class="summary-card">
      <div class="s-value">${fmt(totalYearlyKg)}</div>
      <div class="s-label">kg CO₂/anno (famiglia)</div>
    </div>
    <div class="summary-card">
      <div class="s-value">${fmt(totalMonthlyKg)}</div>
      <div class="s-label">kg CO₂/mese (famiglia)</div>
    </div>
    <div class="summary-card">
      <div class="s-value">${fmt(avgYearly)}</div>
      <div class="s-label">kg CO₂/anno (media pro capite)
        <span class="impact-badge impact-${level}">${impactLabel(level)}</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="s-value">${fmt(avgYearly / 365, 2)}</div>
      <div class="s-label">kg CO₂/giorno (media pro capite)</div>
    </div>
  `;

  // Emissioni per membro
  const membersDiv = document.getElementById('members-summary');
  const maxYearly = Math.max(...memberResults.map(m => m.yearlyKg));
  membersDiv.innerHTML = memberResults.map(m => {
    const pct = maxYearly > 0 ? (m.yearlyKg / maxYearly * 100) : 0;
    const lv  = impactLevel(m.yearlyKg);
    const tags = Object.keys(m.breakdown).map(v =>
      `<span class="transport-tag">${TRANSPORT_LABELS[v]?.split(' ')[0] || v} ${TRANSPORT_LABELS[v]?.split(' ').slice(1).join(' ')}</span>`
    ).join('');
    return `
      <div class="member-result-row">
        <div class="member-result-name">${m.nome}
          <span class="impact-badge impact-${lv}">${impactLabel(lv)}</span>
        </div>
        <div class="transport-tags">${tags}</div>
        <div class="member-result-bar">
          <div class="member-result-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="member-result-val">
          ${fmt(m.yearlyKg)} kg/anno<br>
          <small>${fmt(m.monthlyKg)} kg/mese</small>
        </div>
      </div>`;
  }).join('');

  // Disegna grafici (dopo che il DOM è pronto)
  setTimeout(() => {
    drawBarChart(results);
    drawPieChart(results);
  }, 100);

  // Prepara contesto AI
  prepareAIContext(results);
}

function fmt(n, decimals = 0) {
  return Number(n).toFixed(decimals).replace('.', ',');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ GRAFICI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CHART_COLORS = ['#3a8c3f','#5dbf63','#a8d5a2','#2d6e31','#c8e6c9','#8bc48a','#1a4a1a'];

function drawBarChart(results) {
  const canvas = document.getElementById('chart-bar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const members = results.memberResults;

  // Dimensioni responsive
  const W = canvas.offsetWidth || 340;
  const H = 240;
  canvas.width  = W;
  canvas.height = H;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e0f0d8' : '#1a2e14';
  const gridColor = isDark ? '#2d4a2a' : '#d0e8cc';

  ctx.clearRect(0, 0, W, H);

  const pad = { top: 20, right: 20, bottom: 55, left: 55 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const maxVal = Math.max(...members.map(m => m.yearlyKg), 1);

  // Griglia
  const steps = 4;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = `11px system-ui`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let s = 0; s <= steps; s++) {
    const y = pad.top + chartH - (s / steps) * chartH;
    const val = (s / steps) * maxVal;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(fmt(val), pad.left - 4, y + 4);
  }

  // Barre
  const barW = Math.min(60, (chartW / members.length) * 0.65);
  const gap   = chartW / members.length;
  members.forEach((m, i) => {
    const barH = (m.yearlyKg / maxVal) * chartH;
    const x = pad.left + i * gap + gap / 2 - barW / 2;
    const y = pad.top + chartH - barH;

    // Bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, CHART_COLORS[i % CHART_COLORS.length]);
    grad.addColorStop(1, CHART_COLORS[(i + 2) % CHART_COLORS.length]);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 5);
    ctx.fill();

    // Valore sopra la barra
    ctx.fillStyle = textColor;
    ctx.font = `bold 11px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(fmt(m.yearlyKg), x + barW / 2, y - 5);

    // Nome sotto
    ctx.font = `11px system-ui`;
    ctx.fillText(m.nome, x + barW / 2, pad.top + chartH + 18);

    // kg/anno label
    ctx.font = `10px system-ui`;
    ctx.fillStyle = isDark ? '#8bc48a' : '#4e7042';
    ctx.fillText('kg/anno', x + barW / 2, pad.top + chartH + 30);
    ctx.fillStyle = textColor;
  });
}

function drawPieChart(results) {
  const canvas = document.getElementById('chart-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.offsetWidth || 340;
  const H = 240;
  canvas.width  = W;
  canvas.height = H;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e0f0d8' : '#1a2e14';

  ctx.clearRect(0, 0, W, H);

  const breakdown = results.famBreakdown;
  const entries = Object.entries(breakdown).filter(([,v]) => v > 0);
  const total = entries.reduce((s,[,v]) => s + v, 0);

  if (total === 0 || entries.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Nessuna emissione (ottimo! 🌱)', W/2, H/2);
    return;
  }

  const cx = W * 0.38;
  const cy = H / 2;
  const r  = Math.min(cx, cy) - 20;
  const r2 = r * 0.55; // donut inner radius

  let startAngle = -Math.PI / 2;

  // Disegna fette
  entries.forEach(([mezzo, val], i) => {
    const angle = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = isDark ? '#111c10' : '#f0f7ee';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += angle;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r2, 0, 2 * Math.PI);
  ctx.fillStyle = isDark ? '#1a2e14' : '#ffffff';
  ctx.fill();

  // Testo centrale
  ctx.fillStyle = isDark ? '#5dbf63' : '#3a8c3f';
  ctx.font = `bold 11px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('CO₂', cx, cy - 6);
  ctx.fillText('per mezzo', cx, cy + 10);

  // Legenda
  const legendX = W * 0.72;
  let legendY = Math.max(20, cy - (entries.length * 18) / 2);
  ctx.font = `11px system-ui`;
  ctx.textAlign = 'left';
  entries.forEach(([mezzo, val], i) => {
    const pct = ((val / total) * 100).toFixed(1);
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(legendX - 18, legendY - 9, 12, 12);
    ctx.fillStyle = textColor;
    const label = TRANSPORT_LABELS[mezzo]?.split(' ').slice(1).join(' ') || mezzo;
    ctx.fillText(`${label} (${pct}%)`, legendX, legendY);
    legendY += 18;
  });
}

// Utility: rect con angoli arrotondati
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ AI CHAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let aiContext = '';  // contesto emissioni da passare al modello

function prepareAIContext(results) {
  const lines = results.memberResults.map(m => {
    const mezzi = Object.keys(m.breakdown).map(v => TRANSPORT_LABELS[v]).join(', ');
    return `- ${m.nome}: ${fmt(m.yearlyKg)} kg CO₂/anno | ${fmt(m.monthlyKg)} kg/mese | mezzi: ${mezzi}`;
  });
  aiContext = `Dati emissioni nucleo familiare (${results.memberResults.length} membri):
${lines.join('\n')}
Totale famiglia: ${fmt(results.totalYearlyKg)} kg CO₂/anno, ${fmt(results.totalMonthlyKg)} kg/mese.`;
}

async function sendToOllama(userMessage) {
  const prompt = `${SYSTEM_PROMPT}

Contesto dati emissioni:
${aiContext}

Utente: ${userMessage}
Assistente:`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.response || '(risposta vuota)';
}

function appendChatMessage(role, text) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg msg-${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'ai' ? '🌿' : '👤'}</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setupChat() {
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('btn-send');

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    btn.disabled = true;

    appendChatMessage('user', text);

    // Typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg msg-ai msg-typing';
    typingDiv.innerHTML = '<div class="msg-avatar">🌿</div><div class="msg-bubble"></div>';
    document.getElementById('chat-messages').appendChild(typingDiv);
    document.getElementById('chat-messages').scrollTop = 9999;

    try {
      const reply = await sendToOllama(text);
      typingDiv.remove();
      appendChatMessage('ai', reply);
      document.getElementById('ollama-status').classList.add('hidden');
    } catch (err) {
      typingDiv.remove();
      document.getElementById('ollama-status').classList.remove('hidden');
      appendChatMessage('ai', '⚠️ Non riesco a connettermi a Ollama. Assicurati che il servizio sia avviato con "ollama serve".');
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  btn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Domande rapide
  document.querySelectorAll('.quick-btn').forEach(b => {
    b.addEventListener('click', () => {
      input.value = b.dataset.q;
      sendMessage();
    });
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ LOCAL STORAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function saveFormToStorage() {
  try {
    const n = parseInt(document.getElementById('num-members').value) || 0;
    const saved = { n, members: [] };
    for (let i = 0; i < n; i++) {
      const nameEl = document.getElementById(`name-${i}`);
      saved.members.push({ nome: nameEl ? nameEl.value : '' });
    }
    localStorage.setItem('co2_form_data', JSON.stringify(saved));
    localStorage.setItem('co2_num_members', n.toString());

    // Feedback visivo sul bottone
    const btn = document.getElementById('btn-salva');
    const original = btn.textContent;
    btn.textContent = '✅ Salvato!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch(e) {
    console.warn('Impossibile salvare su localStorage:', e);
  }
}

function loadSavedFormData() {
  try {
    const raw = localStorage.getItem('co2_form_data');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.members) return;
    saved.members.forEach((m, i) => {
      const inp = document.getElementById(`name-${i}`);
      if (inp && m.nome) inp.value = m.nome;
    });
    updateSharedMemberSelectors();
  } catch(e) {
    console.warn('Errore caricamento dati salvati:', e);
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PDF EXPORT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function exportPDF() {
  window.print();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ INIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function init() {
  initTheme();

  // Bottone "Genera form"
  document.getElementById('btn-genera').addEventListener('click', () => {
    const n = parseInt(document.getElementById('num-members').value);
    if (!n || n < 1 || n > 15) {
      alert('Inserisci un numero di componenti tra 1 e 15.');
      return;
    }
    generateMembersForm(n);
    // Scroll al form
    const container = document.getElementById('members-container');
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Bottone "Salva dati"
  document.getElementById('btn-salva').addEventListener('click', saveFormToStorage);

  // Bottone "Calcola emissioni"
  document.getElementById('btn-calcola').addEventListener('click', () => {
    const n = parseInt(document.getElementById('num-members').value) || 0;
    if (n === 0 || document.getElementById('members-container').children.length === 0) {
      alert('Prima genera il form con il numero di componenti.');
      return;
    }

    const data = collectFormData();
    const errors = validateData(data);
    if (errors.length > 0) {
      alert('⚠️ Errori nel form:\n' + errors.join('\n'));
      return;
    }

    familyData = data;
    resultsData = calculateFamily(data);

    // Salva automaticamente
    saveFormToStorage();

    showResults(resultsData);
  });

  // Bottone "Torna indietro"
  document.getElementById('btn-indietro').addEventListener('click', () => {
    document.getElementById('page-results').classList.add('hidden');
    document.getElementById('page-input').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Bottone "Scarica PDF"
  document.getElementById('btn-pdf').addEventListener('click', exportPDF);

  // Setup chat
  setupChat();

  // Enter su input membri → genera form
  document.getElementById('num-members').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-genera').click();
  });

  // Carica numero membri salvato
  const savedN = localStorage.getItem('co2_num_members');
  if (savedN) {
    document.getElementById('num-members').value = savedN;
  }

  // Ridisegna grafici al cambio tema
  document.getElementById('btn-theme').addEventListener('click', () => {
    if (resultsData && resultsData.memberResults) {
      setTimeout(() => {
        drawBarChart(resultsData);
        drawPieChart(resultsData);
      }, 50);
    }
  });

  // Ridisegna grafici al resize
  window.addEventListener('resize', debounce(() => {
    if (resultsData && resultsData.memberResults) {
      drawBarChart(resultsData);
      drawPieChart(resultsData);
    }
  }, 250));
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Avvio
document.addEventListener('DOMContentLoaded', init);
