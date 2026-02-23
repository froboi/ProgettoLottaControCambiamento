# 🌿 CO₂ Familiare – Documentazione del Progetto

**Materia:** Informatica / Educazione Civica  
**Anno scolastico:** 2025/2026  
**Team:** Diego Mostacero · Andrea Piccini · Tommaso Casale Alloa · Simone Gerbino · Francesco Dell'Uomo

---

## 1. Cos'è questo progetto?

**CO₂ Familiare** è una web app educativa che permette a una famiglia di scoprire quanta CO₂ produce ogni giorno per andare e tornare dal lavoro o da scuola.

L'app calcola le emissioni di anidride carbonica (CO₂) in base ai mezzi di trasporto usati da ogni membro della famiglia, mostra i risultati con grafici, e suggerisce cosa si potrebbe fare per inquinare di meno. Per i consigli usa un'intelligenza artificiale (AI) che gira in locale sul computer, senza inviare nulla a internet.

> **In parole semplici:** inserisci come ti sposti, l'app ti dice quanto inquini e cosa puoi fare per migliorare.

---

## 2. Perché lo abbiamo fatto?

Il cambiamento climatico è uno dei problemi più seri del nostro tempo. Uno dei principali responsabili è la CO₂ prodotta dai trasporti privati (auto, moto) che usiamo ogni giorno.

Molte persone non sanno quanto inquina la loro auto rispetto al treno o alla bicicletta. Questo strumento nasce per **rendere visibile** qualcosa che normalmente non si vede: l'impatto ambientale delle nostre abitudini quotidiane.

---

## 3. Come funziona? (spiegazione semplice)

L'app è divisa in **due schermate**:

### Schermata 1 – Inserimento dati

L'utente dice quante persone ci sono in famiglia e per ognuna inserisce:

- **Il nome** (es. "Mario")
- **Come va al lavoro** (andata): in auto, in treno, in bici, a piedi, ecc.
- **Come torna a casa** (ritorno): può essere diverso dall'andata
- **Quanti km fa** per ogni tragitto

Sono disponibili tre categorie di mezzi:

| Categoria | Mezzi disponibili |
|---|---|
| 🚗 Personali | Auto benzina, diesel, ibrida, elettrica, moto |
| 🚆 Pubblici | Treno, metro, autobus |
| 🌿 Ecologici | Bicicletta, a piedi |

Se due persone **condividono l'auto** (carpooling), si può indicarlo: l'app divide l'impatto tra i passeggeri, perché un'auto con 3 persone inquina meno di 3 auto separate.

### Schermata 2 – Risultati

Dopo aver inserito i dati, l'app mostra:

- Quanti **kg di CO₂** produce ogni membro, al mese e all'anno
- Il totale della **famiglia** intera
- Un **indicatore colorato** (verde, giallo, rosso) per capire se l'impatto è basso, medio o alto
- Un **grafico a barre** con le emissioni per persona
- Un **grafico a ciambella** con la distribuzione per mezzo di trasporto

---

## 4. Come calcola la CO₂?

Ogni mezzo di trasporto emette una quantità diversa di CO₂ per ogni km percorso. L'app usa dei valori medi presi da dati europei ufficiali, chiamati **emission factors** (fattori di emissione):

| Mezzo | g CO₂ per km |
|---|---:|
| Auto benzina | 170 g |
| Auto diesel | 150 g |
| Auto ibrida | 90 g |
| Auto elettrica | 47 g |
| Moto | 110 g |
| Autobus | 68 g |
| Metro | 30 g |
| Treno | 14 g |
| Bicicletta / a piedi | 0 g |

**Formula usata:**

```
CO₂ giornaliera (g) = km percorsi × fattore di emissione
CO₂ annua (kg)      = CO₂ giornaliera ÷ 1000 × 220 giorni lavorativi
```

Per il **carpooling** (viaggio condiviso in auto), le emissioni vengono divise per il numero di persone a bordo:

```
CO₂ per persona = CO₂ totale auto ÷ numero passeggeri
```

> **Esempio:** Mario fa 20 km al giorno in auto benzina → 20 × 170 = 3.400 g = 3,4 kg di CO₂ al giorno. In un anno: 3,4 × 220 = **748 kg di CO₂**.

---

## 5. L'intelligenza artificiale (chatbot)

Nella schermata dei risultati c'è un **chatbot** (una chat con un'AI) che risponde a domande sulla mobilità sostenibile e sul modo di ridurre le emissioni, basandosi sui dati inseriti dalla famiglia.

### Come funziona tecnicamente

L'AI non è un servizio online a pagamento come ChatGPT. Usa un programma open source chiamato **Ollama** che fa girare il modello linguistico **phi3** (sviluppato da Microsoft) direttamente sul computer dell'utente. Questo significa:

- ✅ **Nessun dato inviato a internet** – tutto rimane sul tuo computer
- ✅ **Gratuito** – non serve nessun abbonamento
- ✅ **Funziona offline** – non serve la connessione internet (solo per l'AI locale)

### Logica di connessione

L'app tenta di connettersi all'AI in questo ordine:

```
1. Prova il server remoto (PC di casa via VPN)
        ↓ se non risponde
2. Prova Ollama in locale (stesso computer)
        ↓ se non risponde
3. Mostra messaggio: "AI non disponibile"
```

Il chatbot è limitato a rispondere **solo su argomenti ambientali** (CO₂, mobilità, sostenibilità). Se gli si chiede qualcos'altro, risponde che può aiutare solo su quei temi.

---

## 6. Funzionalità extra

### 🌙 Tema chiaro / scuro
L'app ha un pulsante in alto a destra per passare dal tema chiaro (sfondo bianco-verde) al tema scuro (sfondo verde scuro). La scelta viene salvata e ricordata anche dopo aver chiuso il browser.

### 💾 Salvataggio automatico
I dati inseriti vengono salvati automaticamente nel browser (usando una tecnologia chiamata **localStorage**). Se si chiude la pagina e la si riapre, i dati ci sono ancora.

### 📄 Esporta PDF
Il pulsante "Scarica PDF" genera un documento PDF con tutti i risultati, pronto da stampare o condividere. Non serve nessun programma esterno: il browser stampa direttamente la pagina in formato PDF.

### 🔧 Pannello debug AI
C'è un piccolo pannello nascosto (si apre cliccando "🔧 Debug AI") che mostra in tempo reale cosa sta succedendo con la connessione all'AI: quale server viene usato, se risponde, eventuali errori. È utile per diagnosticare problemi senza aprire la console del browser.

### 📱 Responsive
L'app funziona sia su computer che su smartphone/tablet: il layout si adatta automaticamente alla dimensione dello schermo.

---

## 7. Tecnologie usate

Il progetto è stato sviluppato con tecnologie web standard, senza usare framework o librerie esterne:

| Tecnologia | A cosa serve |
|---|---|
| **HTML** | Struttura della pagina (i "mattoni" dell'app) |
| **CSS** | Aspetto grafico (colori, layout, animazioni) |
| **JavaScript** | Logica dell'app (calcoli, grafici, AI, salvataggio) |
| **Canvas API** | Disegno dei grafici (barre e ciambella) in JS puro |
| **localStorage** | Salvataggio dati nel browser |
| **Ollama + phi3** | Intelligenza artificiale locale |
| **Python HTTP server** | Server web minimale per avviare l'app in locale |

Non è stato usato nessun framework (niente React, Vue, Angular) per mantenere il codice semplice e comprensibile, adatto a un progetto scolastico.

---

## 8. Come si avvia

### Requisiti
- Un computer con **Ollama** installato ([ollama.com](https://ollama.com))
- Il modello phi3 scaricato: `ollama pull phi3`
- Python installato (per il server locale)

### Avvio

```bash
# 1. Avvia Ollama con supporto CORS (necessario per il browser)
OLLAMA_ORIGINS=* ollama serve

# 2. In un altro terminale, avvia il server web
cd WebAppCo2
python -m http.server 8080

# 3. Apri il browser su:
http://localhost:8080
```

---

## 9. Struttura dei file

```
ProgettoLottaControCambiamento/
│
├── WebAppCo2/
│   ├── index.html   → struttura della pagina (le due schermate)
│   ├── style.css    → tutto lo stile grafico (tema, colori, layout)
│   └── app.js       → tutta la logica (form, calcoli, grafici, AI)
│
├── PROGETTO.md      → documento iniziale di pianificazione
└── DOCUMENTAZIONE.md → questo file
```

---

## 10. Confronto emissioni: capire i numeri

Per dare un senso ai risultati, ecco qualche riferimento utile:

| Situazione | CO₂ annua stimata |
|---|---:|
| 20 km/giorno in auto benzina | ~748 kg |
| 20 km/giorno in treno | ~62 kg |
| 20 km/giorno in bici | 0 kg |
| Media europea (trasporti) | ~700 kg/persona/anno |
| Albero che assorbe CO₂ in un anno | ~22 kg |

> Per compensare le emissioni di un anno in auto (748 kg) servirebbero circa **34 alberi**.

---

## 11. Possibili miglioramenti futuri

- Aggiungere categorie di emissioni oltre ai trasporti (riscaldamento, alimentazione, ecc.)
- Confronto storico: salvare i dati di mesi diversi per vedere l'evoluzione
- Suggerimenti automatici basati sulla posizione geografica (es. dove sono le piste ciclabili)
- Versione mobile come app installabile (PWA)

---

## 12. Conclusioni

Questo progetto dimostra come la tecnologia possa essere usata per **sensibilizzare** le persone sull'impatto ambientale delle loro abitudini quotidiane. Attraverso dati reali, grafici chiari e consigli personalizzati generati da un'AI, l'app rende concreto un problema che spesso sembra lontano e astratto.

Il cambiamento climatico si combatte anche con piccole scelte di tutti i giorni: scegliere il treno invece dell'auto, condividere un passaggio, andare in bici quando è possibile. Strumenti come questo aiutano a capire **quanto** fanno la differenza queste scelte.

---

*Progetto realizzato nell'ambito del percorso scolastico – febbraio 2026*
