// =============================================================
//  CO₂ FAMILIARE – app.js
//  Logica completa: form, calcolo, grafici, AI, storage, PDF
//
//  Struttura del file:
//   1. COSTANTI         – fattori di emissione, etichette, config Ollama
//   2. TEMA             – dark/light mode con localStorage
//   3. GENERAZIONE FORM – card per ogni membro della famiglia
//   4. RACCOLTA DATI    – lettura del form compilato
//   5. VALIDAZIONE      – controlli sui dati inseriti
//   6. CALCOLO          – emissioni giornaliere/mensili/annuali
//   7. RISULTATI UI     – rendering della pagina risultati
//   8. GRAFICI          – bar chart e donut chart su Canvas
//   9. AI / CHAT        – integrazione Ollama (remoto + locale)
//  10. LOCAL STORAGE    – salvataggio/caricamento dati
//  11. PDF EXPORT       – stampa tramite window.print()
//  12. INIT             – avvio app e registrazione eventi
// =============================================================

"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COSTANTI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Emissioni medie in grammi di CO₂ per chilometro per ogni mezzo di trasporto.
 * Fonti approssimative: ISPRA, EEA (Agenzia Europea dell'Ambiente).
 * - Auto benzina/diesel: media italiana incluse inefficienze traffico
 * - Ibrida:  risparmio ~47% rispetto a benzina
 * - Elettrica: considerata la rete elettrica italiana (~47 gCO₂/km)
 * - Treno:   media treni regionali/intercity italiani
 * - Bicicletta/piedi: emissioni zero (solo quelle umane, trascurabili)
 */
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

/** Etichette leggibili per l'interfaccia, associate ad ogni tipo di mezzo. */
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

// Raggruppamenti dei mezzi per categoria (usati nella generazione del form)
const PERSONAL_VEHICLES  = ['benzina','diesel','ibrida','elettrica','moto'];  // mezzi propri
const PUBLIC_VEHICLES    = ['treno','metro','autobus'];                       // trasporto pubblico
const ECO_VEHICLES       = ['bicicletta','piedi'];                            // zero emissioni
const MOTORIZED_PERSONAL = ['benzina','diesel','ibrida','elettrica','moto'];  // motorizzati (stessa lista, per chiarezza)

// Giorni lavorativi standard: 220 giorni/anno (5 gg × 44 settimane, escluse ferie)
const WORKING_DAYS_YEAR  = 220;
const WORKING_DAYS_MONTH = Math.round(WORKING_DAYS_YEAR / 12); // ≈ 18 giorni/mese

// ── Configurazione Ollama ─────────────────────────────────────────────────────
// Per cambiare l'IP del server remoto modifica solo remoteBase.
const OLLAMA_CONFIG = {
  remoteBase: 'http://192.168.1.9:11434',   // server di casa via VPN
  localBase:  'http://127.0.0.1:11434',     // portatile (fallback)
  model:      'phi3',
  // Nessun timeout sulla generazione: il tempo dipende dal prompt e dalla CPU.
  // Il ping (5s) verifica se il server è acceso prima di avviare la generazione.
};
// Usiamo /api/generate con il campo "system" separato:
// è l'endpoint più compatibile con phi3 e non richiede supporto al ruolo system in messages[].
const OLLAMA_REMOTE_URL = `${OLLAMA_CONFIG.remoteBase}/api/generate`;
const OLLAMA_LOCAL_URL  = `${OLLAMA_CONFIG.localBase}/api/generate`;
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_MODEL = OLLAMA_CONFIG.model;

/**
 * System prompt inviato a Ollama ad ogni richiesta.
 * Mantiene il modello focalizzato esclusivamente sulla sostenibilità.
 * Non includere istruzioni di formato JSON qui: si usano risposte in testo libero.
 */
const SYSTEM_PROMPT =
  'Sei un assistente sulla sostenibilita e CO2. ' +
  'Dai consigli brevi e pratici sulla mobilita sostenibile. ' +
  'Solo argomenti ambientali.';

// ── Stato globale dell'applicazione ─────────────────────────────────────────
let familyData  = [];   // array con i dati del form compilato (un oggetto per membro)
let resultsData = [];   // risultati calcolati (emissioni, breakdown, totali)

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TEMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Legge il tema salvato in localStorage (default: 'dark') e lo applica.
 * Registra anche il listener del bottone toggle tema.
 */
function initTheme() {
  const saved = localStorage.getItem('co2_theme') || 'dark'; // dark di default
  setTheme(saved);
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark'); // alterna tra i due temi
  });
}

/**
 * Applica il tema passato aggiornando l'attributo HTML e l'icona del bottone.
 * Salva la scelta in localStorage per mantenerla al prossimo caricamento.
 * @param {'dark'|'light'} theme
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme); // cambia variabili CSS
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('co2_theme', theme);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ GENERAZIONE FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Genera le card del form per n membri della famiglia.
 * Svuota il container e ricrea tutto da zero per evitare duplicati.
 * @param {number} n - Numero di membri (1–15)
 */
function generateMembersForm(n) {
  const container = document.getElementById('members-container');
  container.innerHTML = ''; // pulisce le card precedenti

  for (let i = 0; i < n; i++) {
    const card = createMemberCard(i, n);
    container.appendChild(card);
  }

  // Mostra il bottone "Calcola emissioni" solo dopo la generazione
  document.getElementById('cta-calcola').classList.remove('hidden');

  // Ogni volta che un nome cambia, aggiorna le checkbox "viaggio condiviso"
  container.querySelectorAll('.member-name-input').forEach(inp => {
    inp.addEventListener('input', updateSharedMemberSelectors);
  });

  // Ripristina i nomi salvati in localStorage (se presenti)
  loadSavedFormData();
}

/**
 * Crea e restituisce il nodo DOM di una singola card membro.
 * Ogni card contiene: nome, tab Andata/Ritorno, pannello con categoria
 * trasporto (personale/pubblico/ecologico), km, opzione viaggio condiviso.
 * @param {number} index - Indice del membro (0-based)
 * @param {number} total - Totale membri (non usato nel rendering ma utile per estensioni)
 * @returns {HTMLElement}
 */
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

/**
 * Genera l'HTML interno di un pannello direzione (andata o ritorno).
 * Include tutte e tre le categorie di trasporto e le relative opzioni.
 * @param {number} mIdx - Indice del membro
 * @param {'andata'|'ritorno'} dir - Direzione del tragitto
 * @returns {string} HTML da inserire nel pannello
 */
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

/**
 * Registra tutti gli eventi interattivi di una card membro:
 * - switch tra tab Andata/Ritorno
 * - selezione categoria trasporto
 * - click sulle opzioni di trasporto (radio/checkbox)
 * - toggle viaggio condiviso e proseguimento separato
 * @param {HTMLElement} card - Elemento DOM della card
 * @param {number} mIdx    - Indice del membro
 */
function setupCardEvents(card, mIdx) {
  // ── Switch tab Andata / Ritorno ──
  card.querySelectorAll('.dir-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const dir = tab.dataset.dir;
      card.querySelectorAll('.dir-tab').forEach(t => t.classList.remove('active'));
      card.querySelectorAll('.direction-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      card.querySelector(`#panel-${mIdx}-${dir}`).classList.add('active');
    });
  });

  // ── Bottoni categoria trasporto (Personale / Pubblico / Ecologico) ──
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

  // ── Selezione visiva opzioni di trasporto e checkboxes trasporto pubblico ──
  // (per personale = radio con .selected visivo; per pubblico = checkbox multipli)
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

/**
 * Mostra il pannello opzioni corretto in base alla categoria selezionata.
 * Nasconde gli altri due pannelli e gestisce la visibilità di:
 * - riga km principale (hidden per pubblico, che ha km per singolo mezzo)
 * - righe km pubblico (visible solo per pubblico)
 * - sezione viaggio condiviso (visible solo per personale)
 * @param {HTMLElement} card
 * @param {number} mIdx
 * @param {'andata'|'ritorno'} dir
 * @param {'personale'|'pubblico'|'ecologico'} cat
 */
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

/**
 * Aggiorna dinamicamente le righe km per ogni mezzo pubblico spuntato.
 * Quando l'utente seleziona treno + metro, vengono mostrati due campi km separati.
 * @param {HTMLElement} card
 * @param {number} mIdx
 * @param {'andata'|'ritorno'} dir
 */
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

/**
 * Aggiorna le checkbox "membri coinvolti" nelle sezioni viaggio condiviso.
 * Viene chiamata ogni volta che viene digitato un nome o creato il form,
 * così le checkbox riflettono sempre i nomi attuali degli altri membri.
 */
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

/**
 * Restituisce la categoria attiva (personale/pubblico/ecologico)
 * per un dato membro e direzione, leggendo il bottone con classe .selected.
 * @param {number} mIdx
 * @param {'andata'|'ritorno'} dir
 * @returns {'personale'|'pubblico'|'ecologico'}
 */
function getActiveCategory(mIdx, dir) {
  const btn = document.querySelector(`.cat-btn.selected[data-midx="${mIdx}"][data-dir="${dir}"]`);
  return btn ? btn.dataset.cat : 'personale';
}

/**
 * Legge tutti i dati di una direzione (andata o ritorno) per un membro.
 * Restituisce un oggetto con:
 * - cat: categoria scelta
 * - segments: array di tratti di viaggio, ciascuno con mezzo, km, condivisione
 *
 * Un membro può avere più segmenti se usa il trasporto pubblico multiplo
 * o se fa parte di un viaggio condiviso con km separati aggiuntivi.
 * @param {number} mIdx
 * @param {'andata'|'ritorno'} dir
 * @returns {{ cat: string, segments: Array }}
 */
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
      // ─ Viaggio condiviso: leggi km condivisi, numero persone, eventuali km separati dopo
      const sharedKm = parseFloat(document.getElementById(`shared-km-${mIdx}-${dir}`)?.value) || 0;
      const nPersone = parseInt(document.getElementById(`shared-n-${mIdx}-${dir}`)?.value) || 2;
      const proseguiEl = document.querySelector(`input[name="prosegui-${mIdx}-${dir}"]:checked`);
      const prosegui = proseguiEl ? proseguiEl.value : 'no';
      // km separati: percorsi dal solo membro dopo essersi separato dal gruppo
      const sepKm = prosegui === 'si'
        ? (parseFloat(document.getElementById(`sep-km-${mIdx}-${dir}`)?.value) || 0)
        : 0;

      // Indici dei membri che condividono lo stesso veicolo
      const memChecked = [...document.querySelectorAll(`input[name="smem-${mIdx}-${dir}"]:checked`)].map(c => parseInt(c.value));

      // Segmento condiviso: le emissioni verranno divise per nPersone nel calcolo
      segments.push({ mezzo, km: sharedKm, shared: true, nPersone, membriCoinvolti: memChecked });
      // Segmento separato (se presente): emissioni solo sue
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

/**
 * Raccoglie i dati di tutti i membri dal form compilato.
 * Per ogni membro restituisce: index, nome, dati andata, dati ritorno.
 * @returns {Array<{index:number, nome:string, andata:Object, ritorno:Object}>}
 */
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

/**
 * Esegue validazioni di base sui dati raccolti.
 * Non blocca per km=0 (può capitare legittimamente), ma blocca per valori
 * negativi o km irrealistici (>1500 km per tratta = impossibile per pendolari).
 * @param {Array} data - Output di collectFormData()
 * @returns {string[]} Array di messaggi di errore (vuoto se tutto ok)
 */
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

/**
 * Converte le emissioni giornaliere di un membro in tutte le unità utili
 * (g/giorno, kg/giorno, kg/mese, kg/anno) e conserva il breakdown per mezzo.
 * @param {Object} member - Oggetto membro da collectFormData()
 * @returns {Object} risultato con nome, dailyG, dailyKg, monthlyKg, yearlyKg, breakdown
 */
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

/**
 * Aggrega i risultati di tutti i membri in totali famiglia.
 * Calcola anche il breakdown familiare sommando i g/giorno per mezzo.
 * @param {Array} data - Output di collectFormData()
 * @returns {{ memberResults, totalYearlyKg, totalMonthlyKg, famBreakdown }}
 */
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

/**
 * Classifica l'impatto annuo pro capite rispetto alla media europea.
 * Soglie: < 400 kg/anno = basso, < 900 = medio, altrimenti elevato.
 * (Media europea trasporti ≈ 700 kg CO₂/anno per pendolari)
 * @param {number} yearlyKgPerPerson
 * @returns {'good'|'medium'|'bad'}
 */
function impactLevel(yearlyKgPerPerson) {
  // Media europea spostamenti: ~700 kg/anno
  if (yearlyKgPerPerson < 400)  return 'good';
  if (yearlyKgPerPerson < 900)  return 'medium';
  return 'bad';
}
/** Restituisce l'’etichetta testuale con emoji per un livello di impatto. */
function impactLabel(level) {
  return { good: '🟢 Basso', medium: '🟡 Medio', high: '🔴 Elevato', bad: '🔴 Elevato' }[level] || '';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RISULTATI UI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Mostra la pagina risultati nascondendo quella di input.
 * Popola: summary cards (totali famiglia), righe per membro,
 * grafici (bar + pie); poi prepara il contesto AI per la chat.
 * @param {{ memberResults, totalYearlyKg, totalMonthlyKg, famBreakdown }} results
 */
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

/** Formatta un numero con il numero di decimali specificato, usando la virgola italiana. */
function fmt(n, decimals = 0) {
  return Number(n).toFixed(decimals).replace('.', ',');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ GRAFICI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Palette di colori del bar chart e del donut chart.
 * I colori sono in scala di verde neon per coerenza con il tema dell'app.
 */
const CHART_COLORS = ['#22c55e','#4ade80','#86efac','#16a34a','#15803d','#34d399','#6ee7b7'];

/**
 * Disegna il bar chart (emissioni annuali per membro) su canvas.
 * Ridisegnato ad ogni cambio tema e ad ogni resize della finestra.
 * @param {{ memberResults: Array }} results
 */
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
  const textColor = isDark ? '#d4f8dc' : '#071a0b';
  const gridColor = isDark ? 'rgba(34,197,94,0.12)' : '#c3e8cc';

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
    ctx.fillStyle = isDark ? '#5a9868' : '#2a6840';
    ctx.fillText('kg/anno', x + barW / 2, pad.top + chartH + 30);
    ctx.fillStyle = textColor;
  });
}

/**
 * Disegna il donut chart (distribuzione emissioni per mezzo di trasporto) su canvas.
 * Donut invece di pie per leggibilità: il cerchio vuoto interno mostra la label "CO₂".
 * @param {{ famBreakdown: Object }} results
 */
function drawPieChart(results) {
  const canvas = document.getElementById('chart-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.offsetWidth || 340;
  const H = 240;
  canvas.width  = W;
  canvas.height = H;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#d4f8dc' : '#071a0b';

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
    ctx.strokeStyle = isDark ? '#0a1809' : '#f2faf4';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += angle;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r2, 0, 2 * Math.PI);
  ctx.fillStyle = isDark ? '#0d1c11' : '#ffffff';
  ctx.fill();

  // Testo centrale
  ctx.fillStyle = isDark ? '#22c55e' : '#16a34a';
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

/**
 * Utility Canvas: disegna un rettangolo con angoli arrotondati.
 * Necessario perché Canvas 2D non ha nativo roundRect in tutti i browser.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - posizione sinistra
 * @param {number} y - posizione in alto
 * @param {number} w - larghezza
 * @param {number} h - altezza
 * @param {number} r - raggio degli angoli
 */
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

// Flusso: ping server (5s timeout) → generazione (nessun timeout: la CPU può essere lenta).
// Strategia fallback: prova prima il server remoto (VPN), poi quello locale.

let aiContext = '';  // contesto emissioni (pre-calcolato) da iniettare in ogni messaggio

/* ── Debug panel ──────────────────────────────────────────────────────────── */

/**
 * Aggiunge una riga al log di debug con timestamp e tipo (ok/warn/err).
 * Viene chiamata in tutti i punti critici del flusso Ollama per tracciare
 * lo stato della connessione in tempo reale.
 * @param {string} msg
 * @param {'ok'|'warn'|'err'} type
 */
function debugLog(msg, type = 'ok') {
  const logEl = document.getElementById('debug-log');
  if (!logEl) return;
  const now = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${now}]</span><span class="log-${type}">${escapeHtml(msg)}</span>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

/** Aggiorna i campi di stato nel pannello debug (URL, server attivo, errore, dot colorati). */
function debugSet(field, value, dotClass) {
  const el = document.getElementById(`dbg-${field}`);
  if (el) el.textContent = value;
  if (dotClass) {
    const dot = document.getElementById(`dbg-${field.replace('-url','-status').replace('-url','-status')}`);
    // gestione dot separata per remote e local
  }
}

/**
 * Aggiorna selettivamente i campi del debug panel.
 * Ogni parametro è opzionale: passa solo quello che vuoi aggiornare.
 */
function debugUpdate({ remoteUrl, localUrl, active, last, error, remoteDot, localDot }) {
  if (remoteUrl !== undefined) {
    document.getElementById('dbg-remote-url').textContent = remoteUrl;
  }
  if (localUrl !== undefined) {
    document.getElementById('dbg-local-url').textContent = localUrl;
  }
  if (active !== undefined) {
    document.getElementById('dbg-active').textContent = active;
  }
  if (last !== undefined) {
    document.getElementById('dbg-last').textContent = last;
  }
  if (error !== undefined) {
    const el = document.getElementById('dbg-error');
    el.textContent = error;
    el.style.color = error === '—' ? '' : 'var(--danger)';
  }
  if (remoteDot !== undefined) {
    const d = document.getElementById('dbg-remote-status');
    d.className = 'debug-dot dot-' + remoteDot;
    d.title = remoteDot;
  }
  if (localDot !== undefined) {
    const d = document.getElementById('dbg-local-status');
    d.className = 'debug-dot dot-' + localDot;
    d.title = localDot;
  }
}

/** Inizializza il debug panel: popola gli URL statici e collega toggle + clear. */
function initDebugPanel() {
  // Popola URL statici
  debugUpdate({
    remoteUrl: OLLAMA_REMOTE_URL,
    localUrl:  OLLAMA_LOCAL_URL,
    active:    '—',
    last:      '—',
    error:     '—',
    remoteDot: 'idle',
    localDot:  'idle',
  });

  // Toggle apertura/chiusura
  document.getElementById('debug-toggle')?.addEventListener('click', () => {
    const body  = document.getElementById('debug-body');
    const arrow = document.getElementById('debug-arrow');
    const open  = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    arrow.textContent = open ? '▸' : '▾';
  });

  document.getElementById('debug-clear')?.addEventListener('click', () => {
    const log = document.getElementById('debug-log');
    if (log) log.innerHTML = '';
  });
}

/**
 * Costruisce il contesto da passare al modello AI insieme al messaggio utente.
 * Il contesto è compatto (pochi token) perché phi3 su CPU è lento:
 * più token = più tempo di generazione.
 * Salvato nella variabile globale aiContext per essere riusato ad ogni messaggio.
 * @param {{ memberResults, totalYearlyKg, totalMonthlyKg }} results
 */
function prepareAIContext(results) {
  // Prompt compatto: phi3 su CPU è lento, meno token = risposta più veloce
  const totAnno  = fmt(results.totalYearlyKg);
  const totMese  = fmt(results.totalMonthlyKg);
  const membri   = results.memberResults.map(m => {
    const mezzi = Object.keys(m.breakdown)
      .map(v => TRANSPORT_LABELS[v].split(' ').slice(1).join(' '))
      .join(', ');
    return `${m.nome}: ${fmt(m.yearlyKg)} kg/anno (${mezzi})`;
  }).join('; ');
  aiContext = `Famiglia: ${results.memberResults.length} membri. Totale: ${totAnno} kg CO2/anno (${totMese}/mese). Dettaglio: ${membri}.`;
}

/**
 * Ping veloce: verifica se il server Ollama è acceso facendo GET sulla root.
 * La root risponde istantaneamente con "Ollama is running" → timeout corto (5s).
 * Se il ping fallisce, saltiamo il server senza aspettare la generazione.
 */
async function pingOllama(baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(baseUrl, { signal: controller.signal });
    return true;   // qualsiasi risposta = server acceso
  } catch {
    return false;  // timeout o rete irraggiungibile
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chiama l'endpoint /api/generate di Ollama.
 * Passa il system prompt nel campo dedicato "system" (Ollama lo inietta
 * nel template del modello → compatibile con qualsiasi versione di phi3).
 * NON usa /api/chat per evitare il 500 legato al ruolo "system" in messages[].
 *
 * @param {string} url    - URL completo dell'endpoint /api/generate
 * @param {string} system - prompt di sistema
 * @param {string} prompt - messaggio utente (include già il contesto emissioni)
 * @returns {Promise<string>}
 */
async function fetchOllama(url, system, prompt, timeoutMs = 0) {
  const controller = new AbortController();
  // timeoutMs === 0 significa nessun timeout (utile per ollama locale su CPU lenta)
  const timer = timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    debugLog(`→ Invio richiesta a ${url}${timeoutMs > 0 ? ` (timeout ${timeoutMs/1000}s)` : ' (nessun timeout)'}`, 'warn');
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:  OLLAMA_MODEL,
        system: system,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      let errBody = '';
      try { errBody = await response.text(); } catch { /* ignore */ }
      const msg = `HTTP ${response.status}: ${errBody.slice(0, 120)}`;
      console.error(`[Ollama] ${msg} da ${url}`);
      debugLog(`✗ ${url} → ${msg}`, 'err');
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data?.response ?? '';
    if (!content) throw new Error('Risposta AI vuota');
    debugLog(`✓ Risposta ricevuta da ${url} (${content.length} caratteri)`, 'ok');
    return content.trim();

  } catch (err) {
    if (err.name === 'AbortError') {
      const msg = `Timeout: nessuna risposta entro ${timeoutMs / 1000}s`;
      debugLog(`✗ ${url} → ${msg}`, 'err');
      throw new Error(msg);
    }
    if (err.message.startsWith('HTTP')) throw err;
    debugLog(`✗ ${url} → ${err.message} (rete/CORS)`, 'err');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Logica di fallback: remoto (VPN) → locale → errore.
 *
 * NOTA CORS: il probe GET cross-origin viene volutamente RIMOSSO perché il browser
 * lo blocca con CORS prima che raggiunga il server, rendendo il remoto sempre "down".
 * Si tenta direttamente la chiamata: se CORS non è configurato sul remoto, il browser
 * mostra un TypeError di rete che viene catturato e passa al fallback locale.
 * Per abilitare il remoto: OLLAMA_ORIGINS=* ollama serve  (sul PC di casa).
 */
async function sendToOllama(userMessage) {
  const userWithContext = aiContext
    ? `Contesto: ${aiContext} Domanda: ${userMessage}`
    : userMessage;

  debugUpdate({ active: 'In corso…', error: '—', remoteDot: 'idle', localDot: 'idle' });
  debugLog('── Nuova richiesta AI ──', 'warn');

  // ── Tentativo 1: server remoto via VPN ──────────────────────────────────
  debugLog(`Tentativo 1: ping remoto ${OLLAMA_CONFIG.remoteBase}…`, 'warn');
  debugUpdate({ last: `Remoto (${OLLAMA_REMOTE_URL})`, remoteDot: 'idle' });
  const remoteAlive = await pingOllama(OLLAMA_CONFIG.remoteBase);
  if (!remoteAlive) {
    debugLog('✗ Remoto non raggiungibile (ping fallito), passo al locale', 'err');
    debugUpdate({ remoteDot: 'error' });
  } else {
    debugLog('✓ Remoto raggiungibile, avvio generazione (senza timeout)…', 'ok');
    debugUpdate({ remoteDot: 'ok', active: '🌐 Remoto – generazione in corso…' });
    try {
      const reply = await fetchOllama(OLLAMA_REMOTE_URL, SYSTEM_PROMPT, userWithContext, 0);
      setOllamaStatus('remote');
      debugUpdate({ active: '🌐 Remoto (VPN)', error: '—' });
      debugLog('✓ Risposta ricevuta dal server remoto', 'ok');
      return reply;
    } catch (errRemote) {
      debugUpdate({ remoteDot: 'error' });
      debugLog(`✗ Remoto fallito dopo ping ok: ${errRemote.message}`, 'err');
      console.info(`[Ollama] Remoto fallito (${errRemote.message}), provo locale…`);
    }
  }

  // ── Tentativo 2: Ollama locale (fallback) ───────────────────────────────
  debugLog(`Tentativo 2: ping locale ${OLLAMA_CONFIG.localBase}…`, 'warn');
  debugUpdate({ last: `Locale (${OLLAMA_LOCAL_URL})`, localDot: 'idle' });
  const localAlive = await pingOllama(OLLAMA_CONFIG.localBase);
  if (!localAlive) {
    debugLog('✗ Locale non raggiungibile (ping fallito)', 'err');
    debugUpdate({ localDot: 'error' });
  } else {
    debugLog('✓ Locale raggiungibile, avvio generazione (senza timeout)…', 'ok');
    debugUpdate({ localDot: 'ok', active: '💻 Locale – generazione in corso…' });
    try {
      const reply = await fetchOllama(OLLAMA_LOCAL_URL, SYSTEM_PROMPT, userWithContext, 0);
      setOllamaStatus('local');
      debugUpdate({ active: '💻 Locale', error: '—' });
      debugLog('✓ Risposta ricevuta da Ollama locale', 'ok');
      return reply;
    } catch (errLocal) {
      debugUpdate({ localDot: 'error' });
      debugLog(`✗ Locale fallito dopo ping ok: ${errLocal.message}`, 'err');
      console.warn('[Ollama] Locale fallito:', errLocal.message);
    }
  }

  // ── Entrambi non disponibili ─────────────────────────────────────────────
  const errMsg = 'Entrambi i server non disponibili';
  debugUpdate({ active: '✗ Non disponibile', error: errMsg });
  debugLog(`✗ ${errMsg}`, 'err');
  setOllamaStatus('unavailable');
  throw new Error('AI non disponibile');
}

/**
 * Aggiunge una bolla messaggio (utente o AI) nella finestra chat.
 * @param {'user'|'ai'} role - Mittente del messaggio
 * @param {string} text     - Testo in chiaro (verrà escaped per sicurezza)
 * @returns {HTMLElement} Il div appena creato (usato per rimuovere il typing indicator)
 */
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

/**
 * Escaping HTML di base per prevenire XSS nei messaggi chat.
 * Solo i 3 caratteri critici: &, <, >
 */
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Stato connessione Ollama ─────────────────────────────────────────────── */

/**
 * Aggiorna la barra di stato Ollama (colorata e con messaggio descrittivo).
 * Abilita o disabilita input/bottone chat in base alla disponibilità.
 * @param {'remote'|'local'|'unavailable'|'idle'} status
 */
function setOllamaStatus(status) {
  const el = document.getElementById('ollama-status');
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('btn-send');

  el.className = 'ollama-status-bar';

  switch (status) {
    case 'remote':
      el.className += ' status-ok';
      el.innerHTML = '🌐 AI connessa al server remoto (VPN)';
      el.classList.remove('hidden');
      input.disabled = false;
      btn.disabled   = false;
      break;
    case 'local':
      el.className += ' status-warn';
      el.innerHTML = '💻 AI connessa a Ollama locale (server remoto non raggiungibile)';
      el.classList.remove('hidden');
      input.disabled = false;
      btn.disabled   = false;
      break;
    case 'unavailable':
      el.className += ' status-error';
      el.innerHTML = '⚠️ AI non disponibile. Possibili cause: VPN non attiva · Ollama non avviato (<code>ollama serve</code>) · CORS non abilitato (<code>OLLAMA_ORIGINS=* ollama serve</code>).';
      el.classList.remove('hidden');
      input.disabled = true;
      btn.disabled   = true;
      break;
    default: // 'idle'
      el.classList.add('hidden');
      input.disabled = false;
      btn.disabled   = false;
  }
}

/* ── Setup chat ───────────────────────────────────────────────────────────── */

/**
 * Configura la chat AI:
 * - bottone Invia e tasto Enter per inviare messaggi
 * - mostra typing indicator durante la generazione
 * - bottoni domande rapide (quick-btn)
 * Disabilita l'input se l'AI risulta non disponibile dopo il tentativo.
 */
function setupChat() {
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('btn-send');

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || btn.disabled) return;
    input.value = '';
    btn.disabled = true;

    appendChatMessage('user', text);

    // Typing indicator con loader
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg msg-ai msg-typing';
    typingDiv.innerHTML = '<div class="msg-avatar">🌿</div><div class="msg-bubble"><span class="typing-loader"></span> Generazione risposta in corso…</div>';
    document.getElementById('chat-messages').appendChild(typingDiv);
    document.getElementById('chat-messages').scrollTop = 9999;

    try {
      const reply = await sendToOllama(text);
      typingDiv.remove();
      appendChatMessage('ai', reply);
    } catch (err) {
      typingDiv.remove();
      appendChatMessage('ai', '⚠️ AI non disponibile. Verifica la VPN oppure avvia Ollama in locale con <ollama serve>.');
    } finally {
      // riabilita input solo se l'AI non è in stato "unavailable"
      const statusEl = document.getElementById('ollama-status');
      if (!statusEl.classList.contains('status-error')) {
        input.disabled = false;
        btn.disabled   = false;
        input.focus();
      }
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

/**
 * Salva in localStorage il numero di membri e i nomi inseriti,
 * così l'utente non deve riscrivere ogni volta che riapre la pagina.
 * Mostra un feedback visivo "Salvato!" sul bottone per 1,5 secondi.
 */
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

/**
 * Ripristina i nomi dei membri dal localStorage (se presenti).
 * Viene chiamata dopo generateMembersForm() in modo che i campi già esistano nel DOM.
 */
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

/**
 * Esporta la pagina risultati come PDF tramite il dialogo di stampa del browser.
 * Il CSS include regole @media print per nascondere header, chat e bottoni.
 */
function exportPDF() {
  window.print();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ INIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Punto di ingresso dell'applicazione.
 * Chiamata da DOMContentLoaded: inizializza il tema, registra tutti i listener
 * dei bottoni principali, carica eventuali dati salvati e prepara chat + debug panel.
 */
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

  // Setup chat e debug panel
  setupChat();
  initDebugPanel();

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

/**
 * Debounce: ritarda l'esecuzione di fn di `delay` ms dopo l'ultima chiamata.
 * Usato per ridisegnare i grafici solo quando il resize della finestra si ferma.
 * @param {Function} fn
 * @param {number} delay - millisecondi di attesa
 */
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Avvio
document.addEventListener('DOMContentLoaded', init);
