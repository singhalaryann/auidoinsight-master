import OpenAI from "openai";
import type { AnalyticsPillar, IntentClassification } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "",
});

export async function classifyIntent(
  question: string,
): Promise<IntentClassification> {
  try {
    const prompt = `Analyze this analytics question and classify it into relevant pillars. Return a JSON object with the format:
{
  "pillars": ["pillar1", "pillar2"],
  "confidence": 0.85,
  "primaryPillar": "pillar1"
}

Available pillars:
- "engagement": User activity, session duration, feature usage, DAU/MAU
- "retention": Churn, cohort analysis, user retention rates
- "monetization": Revenue, ARPU, conversion rates, subscription metrics
- "store": E-commerce sales, product performance, cart metrics
- "ua": User acquisition, marketing campaigns, channel performance
- "techHealth": System uptime, performance, error rates, technical metrics
- "social": Sharing, viral metrics, social media performance

Question: "${question}"

Requirements:
- confidence must be between 0 and 1
- only include pillars that are clearly relevant (confidence >= 0.6)
- primaryPillar should be the most relevant one
- if no clear intent, return low confidence and best guess`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert analytics intent classifier. Analyze user questions and map them to relevant analytics pillars with confidence scores.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and sanitize the response
    const validPillars: AnalyticsPillar[] = [
      "engagement",
      "retention",
      "monetization",
      "store",
      "ua",
      "techHealth",
      "social",
    ];
    const filteredPillars = (result.pillars || []).filter((p: string) =>
      validPillars.includes(p as AnalyticsPillar),
    );

    return {
      pillars: filteredPillars.length > 0 ? filteredPillars : ["engagement"],
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      primaryPillar: validPillars.includes(result.primaryPillar)
        ? result.primaryPillar
        : filteredPillars[0] || "engagement",
    };
  } catch (error) {
    console.error("Error classifying intent:", error);
    // Fallback classification
    return {
      pillars: ["engagement"],
      confidence: 0.3,
      primaryPillar: "engagement",
    };
  }
}

export async function parseAnalyticsQuestion(question: string): Promise<{
  is_ambiguous: boolean;
  parsed_request: {
    subject_cohort: string | null;
    comparison_cohort: string | null;
    metric: string | null;
    time_window: string | null;
    success_criterion: string | null;
  };
  clarifying_questions: string[];
}> {
  const SYSTEM_PROMPT = `You are **Analytics Copilot – Query Parser**.

Your job: turn a product-analytics question into either  
(A) a fully specified analysis request, *or*  
(B) a list of follow-up questions when details are missing.

Follow this procedure:

1. **Extract entities**  
   • SUBJECT_COHORT – who or what is being measured (e.g. "booster users").  
   • COMPARISON_COHORT – against whom? (e.g. "non-booster users", "overall baseline").  
   • METRIC – the KPI (e.g. "average sessions/day", "retention rate").  
   • TIME_WINDOW – over what period? (e.g. "last 30 d", "Week 22 2025").  
   • SUCCESS_CRITERION – optional test or threshold (e.g. "> 5 % lift", "statistically significant at 95 %").  

2. **Detect ambiguity**  
   If any of the five items above is **missing, vague, or could be interpreted ≥ 2 ways**, set \`is_ambiguous = true\`.

3. **When ambiguous**  
   • Create concise CLARIFYING QUESTIONS that a non-technical PM can answer quickly.  
   • Each question should resolve exactly **one** missing piece.  
   • Ask about *metric first*, then *comparison cohort*, then *time window*, then anything else.

4. **Return JSON ONLY** with this schema:

\`\`\`json
{
  "is_ambiguous": <true|false>,
  "parsed_request": {
    "subject_cohort": "<string|null>",
    "comparison_cohort": "<string|null>",
    "metric": "<string|null>",
    "time_window": "<string|null>",
    "success_criterion": "<string|null>"
  },
  "clarifying_questions": [ "<q1>", "<q2>", ... ]  // empty if not ambiguous
}
\`\`\``;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question }
    ],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content ?? "{}";
  
  // Extract JSON from markdown code blocks or plain text
  let jsonContent = content;
  
  // Try to extract JSON from markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  } else {
    // Remove any markdown formatting
    jsonContent = content
      .replace(/```json\s*/g, '')
      .replace(/\s*```/g, '')
      .replace(/^```\w*\s*/g, '')
      .trim();
  }
  
  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('JSON parsing error:', error);
    console.error('Raw content length:', content.length);
    console.error('First 200 chars:', content.substring(0, 200));
    console.error('Last 200 chars:', content.substring(content.length - 200));
    
    // Try to find JSON anywhere in the response
    const jsonObjectMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonObjectMatch) {
      try {
        console.log('Found potential JSON:', jsonObjectMatch[0]);
        return JSON.parse(jsonObjectMatch[0]);
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e);
      }
    }
    
    // Fallback response for ambiguous questions
    return {
      is_ambiguous: true,
      parsed_request: {
        subject_cohort: null,
        comparison_cohort: null,
        metric: null,
        time_window: null,
        success_criterion: null
      },
      clarifying_questions: [
        "What specific metric should we measure?",
        "Which user group should we analyze?",
        "What time period should we focus on?"
      ]
    };
  }
}

// Keep backward compatibility
export async function generateAnalysisSetup(question: string): Promise<{
  type: "complete" | "needs_clarification";
  analysisSetup?: {
    heading: string;
    description: string;
    hypothesis: string;
    statisticalTest: string;
    userCohort: string;
    timeFrame: string;
  };
  clarificationQuestions?: Array<{
    question: string;
    placeholder: string;
  }>;
}> {
  try {
    const result = await parseAnalyticsQuestion(question);
    
    if (!result.is_ambiguous) {
      return {
        type: "complete",
        analysisSetup: {
          heading: `${result.parsed_request.subject_cohort} ${result.parsed_request.metric} Analysis`,
          description: `Analyze ${result.parsed_request.metric} for ${result.parsed_request.subject_cohort}${result.parsed_request.comparison_cohort ? ` vs ${result.parsed_request.comparison_cohort}` : ''} over ${result.parsed_request.time_window}`,
          hypothesis: result.parsed_request.success_criterion || "Identify significant patterns or differences",
          statisticalTest: result.parsed_request.comparison_cohort ? "Comparative analysis" : "Descriptive analysis",
          userCohort: result.parsed_request.subject_cohort || "All users",
          timeFrame: result.parsed_request.time_window || "Last 30 days"
        }
      };
    } else {
      return {
        type: "needs_clarification",
        clarificationQuestions: result.clarifying_questions.map(q => ({
          question: q,
          placeholder: "Please specify"
        }))
      };
    }
  } catch (error) {
    console.error("Error parsing analytics question:", error);
    return {
      type: "needs_clarification",
      clarificationQuestions: [
        { question: "What specific metric should we measure?", placeholder: "e.g., retention rate" },
        { question: "Which user group should we analyze?", placeholder: "e.g., active users" },
        { question: "What time period should we focus on?", placeholder: "e.g., last 30 days" }
      ]
    };
  }
}

// Keep the old function for backward compatibility, but make it use the new one
export async function generateClarifyingQuestions(
  question: string,
): Promise<string[]> {
  const result = await generateAnalysisSetup(question);
  if (result.type === "needs_clarification" && result.clarificationQuestions) {
    return result.clarificationQuestions.map((q) => q.question);
  }
  return [];
}

export async function generateAnalysisBrief(
  question: string,
  clarifyingQuestions: Array<{ question: string; answer: string }>,
  analysisSetup: any,
): Promise<{
  heading: string;
  description: string;
  hypothesis: string;
  statisticalTest: string;
  userCohort: string;
  timeFrame: string;
}> {
  try {
    const prompt = `You are a senior data-analyst assistant whose job is to turn a business question into a crystal-clear analysis brief that anyone—from a junior PM to the CFO—can read and immediately "get."

User's Question: "${question}"

Clarifying Questions & Answers:
${clarifyingQuestions.map((q, i) => `${i + 1}. ${q.question}\nAnswer: ${q.answer || "Not specified"}`).join("\n\n")}

Analysis Setup Options: ${JSON.stringify(analysisSetup, null, 2)}

Produce exactly six sections in JSON format:

{
  "heading": "Analysis Heading – punchy title, ≤ 12 words",
  "description": "Analysis Description – 1-3 lines on what we're about to discover",
  "hypothesis": "Hypothesis to Test – state H₀ vs H₁ in lay terms plus one down-to-earth analogy (e.g., 'like asking whether coffee drinkers stay awake longer than tea drinkers')",
  "statisticalTest": "Statistical Test & Rationale – name the test and explain why in words an executive with no stats background understands ('We'll use a two-proportion z-test because we just want to see if one percentage is higher than another, the same way we'd compare two election polls.')",
  "userCohort": "User Cohort – who's included, in one elegant sentence free of jargon ('All players who installed in Q1 2025 and finished the tutorial')",
  "timeFrame": "Time Frame – concrete start and end dates or cohort window ('Week 3 after install, sessions dated 1 Jan – 31 Mar 2025')"
}

Keep the language plain-English, board-room ready.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are the Elegant Analysis Framer - an expert at turning technical analysis requests into crystal-clear business briefs.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error: any) {
    console.error("Error generating analysis brief:", error);
    throw new Error(
      `Failed to generate analysis brief: ${error?.message || "Unknown error"}`,
    );
  }
}

export async function generateInsight(
  pillar: AnalyticsPillar,
  data: any,
): Promise<string> {
  try {
    const prompt = `Generate a brief, actionable insight for the ${pillar} analytics pillar based on this data: ${JSON.stringify(data)}. 
    Keep it under 50 words and focus on what action should be taken.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an analytics expert. Generate concise, actionable insights from data.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
    });

    return response.choices[0].message.content || "No insight available";
  } catch (error) {
    console.error("Error generating insight:", error);
    return "Unable to generate insight at this time";
  }
}

export async function refineHypothesis(draft: string): Promise<{
  is_ambiguous: boolean;
  missing_pieces: string[];
  suggested_hypothesis: string;
}> {
  const systemPrompt = `You are **Experiment Designer – Hypothesis Refiner**.

Goal  
Turn a draft hypothesis into a *SMART* test statement:  
• Specific cohort / variant  
• Measurable KPI  
• Expected direction & (optional) magnitude  
• Clear comparison group (baseline)  
• Time-bound window

Procedure  
1. Parse the user's draft.  
2. Mark a component **missing** if it is blank, vague, or implicit.  
   Components to check:  
   - SUBJECT_COHORT  (who? "booster users", "new players")  
   - METRIC          (what KPI?)  
   - DIRECTION       (↑ / ↓ or "different") and optional MAGNITUDE (e.g. "+20 %")  
   - COMPARISON      (against whom? "non-booster users", "last month")  
   - TIMEFRAME       (how long? "this week", "next 30 days")  
3. If ≥ 1 component is missing, set \`is_ambiguous = true\`.  
4. Craft **one** refined hypothesis that plugs every gap with reasonable, explicit detail.  
   • If you must invent a magnitude, pick a round, plausible number (10 – 30 % lift).  
   • If comparison is unclear, default to "similar users not exposed to the variant".  
   • If timeframe is missing, default to "over the next 14 days".  
5. Output **JSON only**:

{
  "is_ambiguous": <true|false>,
  "missing_pieces": ["<COMPONENT_A>", "<COMPONENT_B>", …],
  "suggested_hypothesis": "<single refined sentence>"
}

No extra commentary.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: draft }
      ]
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(response);
  } catch (error) {
    console.error('Error refining hypothesis:', error);
    // Return fallback response
    return {
      is_ambiguous: true,
      missing_pieces: ["TIMEFRAME"],
      suggested_hypothesis: `${draft} over the next 14 days.`
    };
  }
}

export async function getTags(question: string): Promise<string[]> {
  try {
    const SYSTEM_PROMPT = `
You are *Analytics-Intent Tagger*.

Task
Read ONE analytics question in natural language.
Return 1–3 tags that capture the core topics of the question.

Output format
• Tags only, comma-separated, no extra text.
• Example: Engagement, Booster Usage

Approved tags (exact spelling, title-case):

Engagement · Retention · Churn · Monetization · Revenue · Ads · Store
· Booster Usage · Acquisition · Funnel · Cohort · Segmentation
· Conversion · Performance

Guidelines
1. Assign 1 tag if the intent is singular; up to 3 if clearly multi-topic.
2. Order tags by relevance (strongest first).
3. Do NOT invent new tags or add commentary.
4. If none apply directly, choose the most relevant tag from the list.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      temperature: 0,
      max_tokens: 50,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question.trim() }
      ]
    });

    const raw = (completion.choices[0].message.content || "").trim();

    // Defensive parsing
    const tags = raw
      .split(/[,|\n]/)                // comma or newline separated
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));

    // Validate against allowed tags
    const ALLOWED = [
      "Engagement", "Retention", "Churn", "Monetization", "Revenue", "Ads", "Store",
      "Booster Usage", "Acquisition", "Funnel", "Cohort", "Segmentation",
      "Conversion", "Performance"
    ];

    const valid = Array.from(new Set(tags.filter(t => ALLOWED.includes(t))));
    return valid.slice(0, 3).length ? valid.slice(0, 3) : ["Engagement"];
  } catch (error) {
    console.error('Error generating tags with OpenAI:', error);
    return ["Engagement"];
  }
}

export async function generateSuggestedAnswer(question: string, clarifyingQuestion: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      temperature: 0.7,
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You are helping users answer clarifying questions about their analytics inquiries. Provide concise, practical suggestions that would be typical for business analytics contexts. Keep responses under 10 words when possible.`
        },
        {
          role: "user",
          content: `Original question: "${question}"\nClarifying question: "${clarifyingQuestion}"\n\nProvide a brief, practical suggested answer:`
        }
      ]
    });

    return completion.choices[0].message.content?.trim() || "Please specify...";
  } catch (error) {
    console.error('Error generating suggested answer:', error);
    return "Please specify...";
  }
}
