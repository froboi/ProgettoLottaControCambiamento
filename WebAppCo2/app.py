from fastapi import FastAPI
import requests

app = FastAPI()

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"


# 🔥 Funzione chiamata LLM
def genera_consigli(prompt):

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": "phi3",
            "prompt": prompt,
            "stream": False
        }
    )

    return response.json()["response"]


# ✅ Endpoint principale
@app.post("/consigli")
def consigli(km_annui: int, mezzo: str):

    # ✅ Fattori emissione realistici (semplificati)
    fattori = {
        "auto": 0.15,     # kg CO2 / km
        "bus": 0.08,
        "treno": 0.03,
        "aereo": 0.25
    }

    co2 = km_annui * fattori.get(mezzo.lower(), 0.15)

    # ✅ Prompt ottimizzato
    prompt = f"""
    Una famiglia produce circa {co2:.2f} kg di CO2 all'anno.

    Mezzo principale: {mezzo}
    Chilometri annui: {km_annui}

    Fornisci consigli pratici, realistici ed economici
    per ridurre l'impatto ambientale.

    Rispondi in italiano, in modo chiaro.
    """

    risposta_ai = genera_consigli(prompt)

    return {
        "co2_annua": co2,
        "consigli": risposta_ai
    }
