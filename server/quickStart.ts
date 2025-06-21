/**
 * quickStart.ts
 * ------------------------------------------------------------
 * Call OpenAI with a purpose-built *system prompt* to generate
 * 4-6 fresh, BlockHeads-specific QuickStart questions.
 * Keeps a sliding-window history to avoid repetition.
 * ------------------------------------------------------------
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY       // never expose in bundle
});

/*─────────────────────────────────────────────────────────────*/
/*  DATA & CONFIG                                              */
/*─────────────────────────────────────────────────────────────*/

// 20-question memory window
const MAX_HISTORY = 20;
let lastQuestions: string[] = [];

const SYSTEM_PROMPT = `
You are QuickStart-Gen, an assistant that outputs **fresh, varied starter questions** for product-analytics users who manage *BlockHeads* (a 1-minute PvP block-puzzle game).

• Core loop: 60-second head-to-head duels, 9×9 grid.
• Progression: trophy arenas.
• Monetization: coin packs, "Skip-It" ad-removal, coin booster shop.
• Boosters: Meteorite (bomb), Comet (line), Magic Wand (wild).
• Modes: 1-v-1 Duels, 100-player Rumble, limited-time events.

KPIs teams track: engagement, retention, churn, revenue, booster usage, funnel.

Rules
1. Return **4-6** unique questions, newline-separated.
2. Mix at least 3 different themes (engagement, retention, monetization, boosters, events, funnels, cohorts, churn).
3. Each question one concise sentence, ending with "?".
4. DO NOT repeat any of these recent questions:
`;

/*─────────────────────────────────────────────────────────────*/
/*  PUBLIC HELPER                                              */
/*────────────────────────────────────────────────────────────*/

/**
 * Generates BlockHeads QuickStart questions.
 * @param desired number (4-6). Will default to 4.
 * @returns string[] of fresh questions
 */
export async function generateQuickStarts(desired = 4): Promise<string[]> {
  // 1. build the dynamic system prompt with recent history
  const historyBlob =
    lastQuestions.length > 0 ? "\n" + lastQuestions.join("\n") + "\n" : "";
  const prompt = SYSTEM_PROMPT + historyBlob + "\nBegin.";

  // 2. call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 150,
    messages: [{ role: "system", content: prompt }]
  });

  // 3. normalise & split into individual questions
  const raw = (completion.choices[0].message.content || "")
    .trim()
    .replace(/\r/g, "");
  const questions = raw
    .split("\n")
    .map(q => q.trim().replace(/^[-*•\d.]+\s*/, "")) // remove bullets
    .filter(Boolean)
    .slice(0, 6);                                    // cap

  // 4. dedupe against history & each other
  const fresh = questions.filter(
    (q, idx) => !lastQuestions.includes(q) && questions.indexOf(q) === idx
  );

  // 5. back-fill if too few
  while (fresh.length < desired) {
    fresh.push("What factors influence session length in BlockHeads?");
  }

  // 6. update sliding window
  lastQuestions = [...fresh, ...lastQuestions].slice(0, MAX_HISTORY);

  return fresh.slice(0, desired);
}

/*─────────────────────────────────────────────────────────────*/
/*  USAGE EXAMPLE                                              */
/*─────────────────────────────────────────────────────────────*/

// (async () => {
//   const qs = await generateQuickStarts(4);
//   console.log("QuickStart Questions →\n", qs.join("\n"));
// })();