import { FormEvent, useMemo, useState } from 'react';

type Goal = 'perdre' | 'maintenir' | 'prendre';

type AnalyzeResponse = {
  kcalEstimate: number;
  verdict: string;
  coachMessage: string;
  recipes: string[];
  llmUsed: boolean;
  llmProvider: 'groq' | 'ollama' | 'local';
  disclaimer: string;
};

const examples = [
  'Poke bowl saumon, riz, avocat et mangue',
  '2 oeufs, pain complet, yaourt nature et pomme',
  'Burger maison, frites au four, salade',
];

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function apiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

function App() {
  const [meal, setMeal] = useState('');
  const [goal, setGoal] = useState<Goal>('perdre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const streakText = useMemo(() => {
    if (!result) return 'Commence aujourd’hui, 1 choix à la fois.';
    if (result.verdict === 'Très bien') return 'Excellent choix, continue comme ça 🔥';
    if (result.verdict === 'Correct') return 'Bonne base, on ajuste un peu et c’est parfait 💪';
    return 'Pas grave, prochain repas plus léger et tu restes dans le game ✨';
  }, [result]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/coach/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal, goal }),
      });

      const data = (await response.json()) as AnalyzeResponse | { error: string };

      if (!response.ok) {
        setResult(null);
        setError('error' in data ? data.error : 'Erreur serveur.');
        return;
      }

      setResult(data as AnalyzeResponse);
    } catch {
      setResult(null);
      setError('Impossible de contacter le coach. Vérifie que le backend est lancé.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="badge">Coach Diet IA • MVP gratuit</p>
        <h1>Ton coach minceur, simple et motivant</h1>
        <p className="subtitle">
          Tu écris ton repas, on te donne une estimation kcal, un retour clair, et des idées de recettes pour rester sur ton objectif.
        </p>
      </section>

      <section className="card">
        <form onSubmit={onSubmit} className="form">
          <label htmlFor="goal">Objectif</label>
          <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
            <option value="perdre">Perdre du poids</option>
            <option value="maintenir">Maintenir</option>
            <option value="prendre">Prendre du muscle</option>
          </select>

          <label htmlFor="meal">Qu’as-tu mangé ?</label>
          <textarea
            id="meal"
            rows={5}
            placeholder="Ex: Salade poulet, riz, yaourt grec, une pomme"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            required
          />

          <div className="examples">
            {examples.map((text) => (
              <button
                key={text}
                type="button"
                className="chip"
                onClick={() => setMeal(text)}
              >
                {text}
              </button>
            ))}
          </div>

          <button type="submit" className="cta" disabled={loading || meal.trim().length < 6}>
            {loading ? 'Analyse en cours...' : 'Analyser mon repas'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <p className="streak">{streakText}</p>

        {result && (
          <div className="result">
            <div className="kpis">
              <article>
                <span>Estimation</span>
                <strong>{result.kcalEstimate} kcal</strong>
              </article>
              <article>
                <span>Verdict</span>
                <strong>{result.verdict}</strong>
              </article>
            </div>

            <div className="coach">
              <h2>Retour du coach</h2>
              <p>{result.coachMessage}</p>
            </div>

            <div className="coach">
              <h2>3 recettes pour la suite</h2>
              <ul>
                {result.recipes.map((recipe) => (
                  <li key={recipe}>{recipe}</li>
                ))}
              </ul>
            </div>

            <p className="meta">
              Mode: {result.llmUsed ? `LLM ${result.llmProvider}` : 'Fallback local'} • {result.disclaimer}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
