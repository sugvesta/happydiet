# Diet Coach IA — V1 (MVP gratuit)

Landing page mobile-first + API coach nutrition.

## Stack
- Front: React + Vite + PWA
- Back: Express + TypeScript
- LLM gratuit: Groq free tier (public) ou Ollama local

## Démarrage
1. Créer un compte Groq (free tier) et récupérer `GROQ_API_KEY` (option recommandé pour URL publique)
2. Dupliquer `.env.example` en `.env` et renseigner `GROQ_API_KEY`
3. Optionnel: installer Ollama en local comme fallback secondaire
4. Lancer un modèle local (exemple):
   ```bash
   ollama pull llama3.1:8b
   ollama run llama3.1:8b
   ```
5. Lancer l'app:
   ```bash
   npm run dev
   ```
6. Ouvrir le front sur `http://localhost:5173`

## Partager via une URL

Le plus simple est de déployer:
- le front (statique) sur Vercel ou Netlify
- l'API sur Render ou Railway

### 1) Déployer l'API (Render/Railway)
- Variables d'environnement:
  - `PORT=8787`
  - `GROQ_API_KEY` (recommandé pour URL publique gratuite)
  - `GROQ_MODEL=llama-3.1-8b-instant`
  - optionnel: `OLLAMA_URL` et `OLLAMA_MODEL` si tu as un Ollama distant
- Build command: `npm --prefix server run build`
- Start command: `npm --prefix server run start`

### 2) Déployer le front (Vercel/Netlify)
- Build command: `npm --prefix client run build`
- Publish directory: `client/dist`
- Variable front:
  - `VITE_API_URL=https://ton-backend-url.com`

### 3) Vérifier
- Ouvre l'URL front publique
- Soumets un repas
- Vérifie que l'appel part vers `https://ton-backend-url.com/api/coach/analyze`

## Note importante sur le LLM gratuit
- Priorité provider: `Groq` -> `Ollama` -> `fallback local`.
- Si Ollama tourne seulement sur ton Mac, les autres utilisateurs ne peuvent pas y accéder via internet.
- Pour une vraie URL publique gratuite, configure surtout `GROQ_API_KEY`.

## Endpoints API
- `GET /api/health`
- `POST /api/coach/analyze`
  - body:
    ```json
    {
      "meal": "Poulet riz salade",
      "goal": "perdre"
    }
    ```

## Notes
- Les kcal sont une estimation simplifiée (V1).
- Les conseils ne remplacent pas un avis médical.
- Si Ollama n'est pas lancé, l'API bascule automatiquement sur un coach local minimal.
