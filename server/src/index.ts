import cors from 'cors';
import express from 'express';
import { z } from 'zod';

type NutritionInfo = {
  kcalPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
};

const nutritionDb: Record<string, NutritionInfo> = {
  poulet: { kcalPer100g: 165, protein: 31, carbs: 0, fat: 3.6 },
  riz: { kcalPer100g: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  saumon: { kcalPer100g: 208, protein: 20, carbs: 0, fat: 13 },
  thon: { kcalPer100g: 132, protein: 29, carbs: 0, fat: 1 },
  oeuf: { kcalPer100g: 143, protein: 13, carbs: 1.1, fat: 9.5 },
  avocat: { kcalPer100g: 160, protein: 2, carbs: 9, fat: 15 },
  pain: { kcalPer100g: 265, protein: 9, carbs: 49, fat: 3.2 },
  fromage: { kcalPer100g: 330, protein: 20, carbs: 1.5, fat: 27 },
  yaourt: { kcalPer100g: 63, protein: 5.3, carbs: 7, fat: 1.5 },
  pomme: { kcalPer100g: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  banane: { kcalPer100g: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  salade: { kcalPer100g: 18, protein: 1.5, carbs: 3, fat: 0.2 },
  tomate: { kcalPer100g: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  pates: { kcalPer100g: 131, protein: 5, carbs: 25, fat: 1.1 },
  pizza: { kcalPer100g: 266, protein: 11, carbs: 33, fat: 10 },
  burger: { kcalPer100g: 295, protein: 17, carbs: 30, fat: 12 },
  frites: { kcalPer100g: 312, protein: 3.4, carbs: 41, fat: 15 },
  chocolat: { kcalPer100g: 546, protein: 4.9, carbs: 61, fat: 31 },
};

const portionByKeyword: Record<string, number> = {
  poulet: 150,
  riz: 150,
  saumon: 140,
  thon: 120,
  oeuf: 60,
  avocat: 100,
  pain: 60,
  fromage: 40,
  yaourt: 125,
  pomme: 150,
  banane: 120,
  salade: 80,
  tomate: 100,
  pates: 180,
  pizza: 250,
  burger: 220,
  frites: 180,
  chocolat: 30,
};

const analyzeRequestSchema = z.object({
  meal: z.string().min(6, 'Décris un peu plus ton repas.'),
  goal: z.enum(['perdre', 'maintenir', 'prendre']).default('perdre'),
});

const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';
const ollamaUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434/api/chat';
const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';
const groqUrl = process.env.GROQ_URL ?? 'https://api.groq.com/openai/v1/chat/completions';

const app = express();
app.use(cors());
app.use(express.json());

function estimateMealKcal(mealText: string) {
  const normalized = mealText.toLowerCase();
  let totalKcal = 0;
  let foundItems = 0;

  for (const [keyword, info] of Object.entries(nutritionDb)) {
    if (!normalized.includes(keyword)) {
      continue;
    }

    const portion = portionByKeyword[keyword] ?? 100;
    totalKcal += (info.kcalPer100g * portion) / 100;
    foundItems += 1;
  }

  if (foundItems === 0) {
    totalKcal = 550;
  }

  const rounded = Math.round(totalKcal);

  let verdict: 'Très bien' | 'Correct' | 'À équilibrer';
  if (rounded <= 550) {
    verdict = 'Très bien';
  } else if (rounded <= 800) {
    verdict = 'Correct';
  } else {
    verdict = 'À équilibrer';
  }

  return { kcal: rounded, verdict, foundItems };
}

function fallbackCoachMessage(kcal: number, goal: 'perdre' | 'maintenir' | 'prendre') {
  if (goal === 'perdre') {
    if (kcal <= 550) {
      return 'Super repas pour ton objectif. Garde une bonne source de protéines et ajoute des légumes pour la satiété.';
    }
    if (kcal <= 800) {
      return 'Pas mal du tout. Pour optimiser la perte de poids, réduis un peu les aliments denses en calories ou augmente les légumes.';
    }
    return 'Repas un peu riche pour sécher. Tu peux alléger avec une portion plus petite de féculents et une protéine maigre.';
  }

  if (goal === 'maintenir') {
    return 'Repas globalement cohérent. Vise surtout la régularité et un bon équilibre protéines, fibres et glucides.';
  }

  return 'Bonne base pour prise de masse propre. Ajoute une collation protéinée si besoin pour atteindre ton total journalier.';
}

async function getCoachFromOllama(input: {
  meal: string;
  goal: 'perdre' | 'maintenir' | 'prendre';
  kcal: number;
  verdict: string;
}) {
  const systemPrompt = `Tu es un coach nutrition motivant, concret, bienveillant.
Réponds en français, en JSON strict avec les clés:
- coachMessage: string (2-3 phrases max)
- recipes: string[] (3 idées rapides)
Pas de conseils médicaux. Pas de texte hors JSON.`;

  const userPrompt = `Repas: ${input.meal}\nObjectif: ${input.goal}\nEstimation kcal: ${input.kcal}\nVerdict: ${input.verdict}`;

  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}`);
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };

  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error('Réponse vide du modèle');
  }

  const parsed = JSON.parse(content) as {
    coachMessage?: string;
    recipes?: string[];
  };

  if (!parsed.coachMessage || !Array.isArray(parsed.recipes)) {
    throw new Error('Format JSON inattendu');
  }

  return {
    coachMessage: parsed.coachMessage,
    recipes: parsed.recipes.slice(0, 3),
  };
}

async function getCoachFromGroq(input: {
  meal: string;
  goal: 'perdre' | 'maintenir' | 'prendre';
  kcal: number;
  verdict: string;
}) {
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY manquant');
  }

  const systemPrompt = `Tu es un coach nutrition motivant, concret, bienveillant.
Réponds en français, en JSON strict avec les clés:
- coachMessage: string (2-3 phrases max)
- recipes: string[] (3 idées rapides)
Pas de conseils médicaux. Pas de texte hors JSON.`;

  const userPrompt = `Repas: ${input.meal}\nObjectif: ${input.goal}\nEstimation kcal: ${input.kcal}\nVerdict: ${input.verdict}`;

  const response = await fetch(groqUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq error ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Réponse vide du modèle Groq');
  }

  const parsed = JSON.parse(content) as {
    coachMessage?: string;
    recipes?: string[];
  };

  if (!parsed.coachMessage || !Array.isArray(parsed.recipes)) {
    throw new Error('Format JSON inattendu');
  }

  return {
    coachMessage: parsed.coachMessage,
    recipes: parsed.recipes.slice(0, 3),
  };
}

async function getCoach(input: {
  meal: string;
  goal: 'perdre' | 'maintenir' | 'prendre';
  kcal: number;
  verdict: string;
}) {
  if (groqApiKey) {
    try {
      const result = await getCoachFromGroq(input);
      return {
        ...result,
        llmUsed: true,
        llmProvider: 'groq' as const,
      };
    } catch {
      // fallback next provider
    }
  }

  try {
    const result = await getCoachFromOllama(input);
    return {
      ...result,
      llmUsed: true,
      llmProvider: 'ollama' as const,
    };
  } catch {
    return {
      coachMessage: fallbackCoachMessage(input.kcal, input.goal),
      recipes: [
        'Bowl poulet, quinoa, légumes croquants',
        'Omelette légumes + salade + fruit',
        'Saumon au four, riz complet, brocoli',
      ],
      llmUsed: false,
      llmProvider: 'local' as const,
    };
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      groqConfigured: Boolean(groqApiKey),
      groqModel,
      ollamaModel,
    },
  });
});

app.post('/api/coach/analyze', async (req, res) => {
  const parsed = analyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Requête invalide.',
    });
  }

  const { meal, goal } = parsed.data;
  const estimate = estimateMealKcal(meal);
  const llm = await getCoach({
    meal,
    goal,
    kcal: estimate.kcal,
    verdict: estimate.verdict,
  });

  return res.json({
    kcalEstimate: estimate.kcal,
    verdict: estimate.verdict,
    coachMessage: llm.coachMessage,
    recipes: llm.recipes,
    llmUsed: llm.llmUsed,
    llmProvider: llm.llmProvider,
    disclaimer: 'Conseils bien-être généraux, pas un avis médical.',
  });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Diet API running on http://localhost:${port}`);
});
