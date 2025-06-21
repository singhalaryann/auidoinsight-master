/**
 * tagger.ts
 * -----------
 * Multi-label analytics-intent tagger for a React / Node / Next.js front-end.
 * Uses the official OpenAI SDK (`npm i openai`).
 */

export type Tag =
  | "Engagement"
  | "Retention"
  | "Churn"
  | "Monetization"
  | "Revenue"
  | "Ads"
  | "Store"
  | "Booster Usage"
  | "Acquisition"
  | "Funnel"
  | "Cohort"
  | "Segmentation"
  | "Conversion"
  | "Performance";

const ALLOWED: Tag[] = [
  "Engagement",
  "Retention",
  "Churn",
  "Monetization",
  "Revenue",
  "Ads",
  "Store",
  "Booster Usage",
  "Acquisition",
  "Funnel",
  "Cohort",
  "Segmentation",
  "Conversion",
  "Performance"
];

/**
 * getTags("Are booster users heavy engagement drivers?")
 *  -> ["Engagement","Booster Usage"]
 */
export async function getTags(question: string): Promise<Tag[]> {
  try {
    const response = await fetch('/api/generate-tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question.trim() }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate tags');
    }

    const { tags } = await response.json();
    return tags || getFallbackTags(question);
  } catch (error) {
    console.error('Error generating tags:', error);
    return getFallbackTags(question);
  }
}

// Fallback tag generation using keyword matching
function getFallbackTags(question: string): Tag[] {
  const lowerQuestion = question.toLowerCase();
  const foundTags: Tag[] = [];
  
  if (lowerQuestion.includes('engagement') || lowerQuestion.includes('features') || lowerQuestion.includes('activity')) {
    foundTags.push('Engagement');
  }
  if (lowerQuestion.includes('retention') || lowerQuestion.includes('return') || lowerQuestion.includes('comeback')) {
    foundTags.push('Retention');
  }
  if (lowerQuestion.includes('revenue') || lowerQuestion.includes('monetization') || lowerQuestion.includes('money') || lowerQuestion.includes('purchase')) {
    foundTags.push('Monetization');
  }
  if (lowerQuestion.includes('churn') || lowerQuestion.includes('leaving') || lowerQuestion.includes('quit')) {
    foundTags.push('Churn');
  }
  if (lowerQuestion.includes('booster') || lowerQuestion.includes('boost')) {
    foundTags.push('Booster Usage');
  }
  if (lowerQuestion.includes('acquisition') || lowerQuestion.includes('new user') || lowerQuestion.includes('signup')) {
    foundTags.push('Acquisition');
  }
  if (lowerQuestion.includes('conversion') || lowerQuestion.includes('funnel') || lowerQuestion.includes('convert')) {
    foundTags.push('Conversion');
  }
  if (lowerQuestion.includes('performance') || lowerQuestion.includes('speed') || lowerQuestion.includes('loading')) {
    foundTags.push('Performance');
  }
  if (lowerQuestion.includes('ads') || lowerQuestion.includes('advertising')) {
    foundTags.push('Ads');
  }
  if (lowerQuestion.includes('store') || lowerQuestion.includes('shop') || lowerQuestion.includes('purchase')) {
    foundTags.push('Store');
  }
  if (lowerQuestion.includes('cohort') || lowerQuestion.includes('segment')) {
    foundTags.push('Cohort');
  }
  
  return foundTags.length > 0 ? foundTags.slice(0, 3) : ["Engagement"];
}

// Helper function to get tag color class
export function getTagColorClass(tag: Tag): string {
  switch (tag) {
    case 'Engagement': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Retention': return 'bg-green-50 text-green-700 border-green-200';
    case 'Monetization': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Revenue': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Churn': return 'bg-red-50 text-red-700 border-red-200';
    case 'Acquisition': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Conversion': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Performance': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Booster Usage': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'Ads': return 'bg-pink-50 text-pink-700 border-pink-200';
    case 'Store': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Funnel': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Cohort': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Segmentation': return 'bg-slate-50 text-slate-700 border-slate-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}