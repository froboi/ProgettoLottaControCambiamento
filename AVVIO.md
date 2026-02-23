# 🚀 Guida all'avvio del progetto

Questa guida spiega **cosa avviare e in che ordine** per far funzionare l'app, sia sul portatile che sul PC di casa.

---

## 🖥️ Cosa va avviato e dove

| Servizio | Dove gira | Obbligatorio? |
|---|---|---|
| Ollama (AI) | Portatile **oppure** PC di casa | Sì (almeno uno) |
| Server web (HTML) | Portatile | Sì |

---

## 📋 Avvio completo – Portatile (Arch Linux)

Apri **2 terminali separati** e segui l'ordine.

---

### Terminale 1 – Ollama con CORS abilitato

```bash
# Ferma ollama se già in esecuzione
sudo pkill ollama

# Avvialo con CORS abilitato (obbligatorio per il browser)
OLLAMA_ORIGINS=* ollama serve
```

> ⚠️ **Importante:** senza `OLLAMA_ORIGINS=*` il browser blocca le richieste all'AI (errore CORS). Ogni volta che riavvii Ollama devi usare questo comando.

**Verifica che funzioni:**
```bash
curl http://127.0.0.1:11434
# Deve rispondere: "Ollama is running"
```

**Se il modello phi3 non è ancora scaricato:**
```bash
ollama pull phi3
```

---

### Terminale 2 – Server web (app HTML)

```bash
cd /srv/http/ProgettoLottaControCambiamento/WebAppCo2
python -m http.server 8080
```

Poi apri il browser su: **http://localhost:8080**

---

## 🏠 PC di casa (Windows) – solo Ollama remoto via VPN

Sul PC di casa deve girare Ollama con CORS abilitato, così il portatile (via VPN) può usarlo come server AI.

**Opzione A – PowerShell (temporanea, solo per la sessione):**
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**Opzione B – Variabile d'ambiente permanente:**
1. `Win + R` → `sysdm.cpl` → Invio
2. Tab **Avanzate** → **Variabili d'ambiente**
3. Aggiungi nuova variabile di sistema:
   - Nome: `OLLAMA_ORIGINS`
   - Valore: `*`
4. Riavvia Ollama

> Il portatile si collega al PC di casa **solo se la VPN è attiva**.  
> L'app tenta prima il remoto, poi automaticamente il locale se non risponde.

---

## 🔁 Riepilogo ordine di avvio (uso normale)

```
1. [Portatile] OLLAMA_ORIGINS=* ollama serve
2. [Portatile] cd WebAppCo2 && python -m http.server 8080
3. [Browser]   http://localhost:8080
```

Con VPN attiva e PC di casa acceso:
```
1. [PC casa]   ollama serve  (con OLLAMA_ORIGINS=*)
2. [Portatile] python -m http.server 8080
3. [Browser]   http://localhost:8080
```

---

## ⚠️ Problemi comuni

| Problema | Causa | Soluzione |
|---|---|---|
| `address already in use` su porta 11434 | Ollama già in esecuzione | `sudo pkill ollama` poi riavvia |
| AI non disponibile (errore nel chatbot) | CORS non abilitato | Riavvia con `OLLAMA_ORIGINS=* ollama serve` |
| AI molto lenta | phi3 su CPU è lento | Normale, aspetta (nessun timeout impostato) |
| Pagina non carica | Server HTTP non avviato | Avvia il Terminale 2 |
| VPN non funziona | Configurazione VPN | Verifica la connessione VPN prima di usare il remoto |
