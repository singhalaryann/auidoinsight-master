// launchDarkly.ts ------------------------------------------------------------
import axios from "axios";

/**  Launch an experiment winner via LaunchDarkly.
 *
 *  @param token         Server-side API token (role = Writer or custom)
 *  @param projectKey    LD project key, e.g. "blockheads"
 *  @param envKey        Environment key, e.g. "prod"
 *  @param flagKey       Flag key, e.g. "features.booster.ux"
 *  @param winnerKey     Variation *key* to roll out, e.g. "variantB"
 *  @param traffic       0-1 decimal, 1 = 100 %
 */
export async function launchDarklyRollout(
  token: string,
  projectKey: string,
  envKey: string,
  flagKey: string,
  winnerKey: string,
  traffic = 1
): Promise<{ ldVersion: number }> {
  // Map environment names to LaunchDarkly environment keys
  const envMapping: Record<string, string> = {
    'prod': 'production',
    'production': 'production',
    'test': 'test',
    'dev': 'test',
    'development': 'test'
  };
  
  const mappedEnvKey = envMapping[envKey] || envKey;
  
  console.log('LaunchDarkly rollout parameters:', {
    token: token ? '[REDACTED]' : 'undefined',
    projectKey,
    envKey: `${envKey} -> ${mappedEnvKey}`,
    flagKey,
    winnerKey,
    traffic
  });

  const ld = axios.create({
    baseURL: "https://app.launchdarkly.com/api/v2",
    headers: {
      Authorization: token,  // LaunchDarkly doesn't use 'Bearer' prefix
      "Content-Type": "application/json"
    },
    timeout: 10_000
  });

  // ── 1. Get flag to resolve internal variationId ───────────────────────────
  const { data: flag } = await ld.get<LDFlag>(
    `/flags/${projectKey}/${encodeURIComponent(flagKey)}`
  );

  console.log('Flag variations found:', flag.variations.map(v => ({
    id: v._id,
    key: v.key,
    value: (v as any).value,
    name: (v as any).name
  })));

  // Safely handle undefined/null parameters
  const safeWinnerKey = (winnerKey || '').toLowerCase();
  
  const winnerVar = flag.variations.find(v => {
    const safeVarKey = (v.key || '').toLowerCase();
    const safeVarName = ((v as any).name || '').toLowerCase();
    const safeVarValue = String((v as any).value || '').replace(/\s+/g, "").toLowerCase();
    const safeTargetValue = (winnerKey || '').replace(/\s+/g, "").toLowerCase();
    
    console.log(`Comparing "${winnerKey}" with variation:`, {
      key: safeVarKey,
      name: safeVarName,
      value: safeVarValue,
      targetKey: safeWinnerKey,
      targetValue: safeTargetValue,
      keyMatch: safeVarKey === safeWinnerKey,
      nameMatch: safeVarName === safeWinnerKey,
      valueMatch: safeVarValue === safeTargetValue
    });
    
    return safeVarKey === safeWinnerKey || 
           safeVarName === safeWinnerKey || 
           safeVarValue === safeTargetValue;
  });
  
  if (!winnerVar) {
    throw new Error(
      `Variation '${winnerKey}' not found in flag '${flagKey}'. ` +
      `Check LaunchDarkly › Flags › ${flagKey} › Variations.`
    );
  }

  // ── 2. Build instructions object ─────────────────────────────────────────
  const instructions: LDInstruction[] = [{ kind: "turnFlagOn" }];

  if (traffic >= 0.999) {
    instructions.push({
      kind: "updateFixedVariation",
      variationId: winnerVar._id
    });
  } else {
    const weights = Math.round(traffic * 100_000); // LD weight = 1-100 000
    instructions.push({
      kind: "addOrUpdateRule",
      clauses: [],
      variationOrRollout: {
        rollout: {
          kind: "rollout",
          variations: [
            { variation: winnerVar._id, weight: weights },
            {
              variation: flag.variations.find(v => v.key !== winnerKey)!._id,
              weight: 100_000 - weights
            }
          ]
        }
      }
    });
  }

  // ── 3. Patch flag using correct LaunchDarkly API format ──────────────────
  // Use JSON patch operations for environment-specific updates
  const jsonPatchOps = instructions.map(instruction => {
    if (instruction.kind === "turnFlagOn") {
      return {
        op: "replace",
        path: `/environments/${mappedEnvKey}/on`,
        value: true
      };
    } else if (instruction.kind === "updateFixedVariation") {
      return {
        op: "replace", 
        path: `/environments/${mappedEnvKey}/fallthrough/variation`,
        value: parseInt(winnerVar._id.split('-')[0], 16) % flag.variations.length // Convert ID to index
      };
    }
    return instruction;
  });

  console.log('Sending LaunchDarkly JSON patch:', JSON.stringify(jsonPatchOps, null, 2));
  
  try {
    // Use axios directly for precise control over the request
    const response = await axios.patch(
      `https://app.launchdarkly.com/api/v2/flags/${projectKey}/${encodeURIComponent(flagKey)}`,
      jsonPatchOps,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json-patch+json"
        }
      }
    );
    
    console.log('LaunchDarkly patch successful:', response.data);
    return { ldVersion: response.data.version || response.data._version || Date.now() };
  } catch (error: any) {
    console.error('LaunchDarkly patch failed:', error.response?.data || error.message);
    
    // Provide detailed error information
    throw new Error(
      `LaunchDarkly deployment failed: ${error.response?.data?.message || error.message}. ` +
      `Verify flag "${flagKey}" exists in project "${projectKey}" environment "${envKey}".`
    );
  }
}

/* ── LaunchDarkly response types (minimal subset) ────────────────────── */

interface LDFlag {
  variations: { _id: string; key: string; value?: any }[];
}

type LDInstruction =
  | { kind: "turnFlagOn" }
  | {
      kind: "updateFixedVariation";
      variationId: string;
    }
  | {
      kind: "addOrUpdateRule";
      clauses: unknown[];
      variationOrRollout: {
        rollout: {
          kind: "rollout";
          variations: { variation: string; weight: number }[];
        };
      };
    };

interface LDPatchResponse {
  version: number; // new flag version number
}