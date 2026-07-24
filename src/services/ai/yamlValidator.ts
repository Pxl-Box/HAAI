import { StorageService } from '../storage';
import { AIToolCall } from '../../types/ai';

export interface ValidationWarning {
  entityId: string;
  usedIn: string;
  suggestion?: string;
  autoFixed?: boolean; // true if we patched this without an AI call
}

export interface ValidationResult {
  isClean: boolean;
  unknownEntities: ValidationWarning[];
  checkedEntityCount: number;
  autoFixedCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract every entity_id string from a nested object/array structure.
// ─────────────────────────────────────────────────────────────────────────────

function extractEntityIds(obj: any, path = ''): { path: string; entityId: string }[] {
  const results: { path: string; entityId: string }[] = [];
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => results.push(...extractEntityIds(item, `${path}[${i}]`)));
    return results;
  }
  if (obj.entity_id !== undefined) {
    const val = obj.entity_id;
    if (typeof val === 'string') results.push({ path: path ? `${path}.entity_id` : 'entity_id', entityId: val });
    else if (Array.isArray(val)) val.forEach((eid: string, i: number) => {
      if (typeof eid === 'string') results.push({ path: `${path}.entity_id[${i}]`, entityId: eid });
    });
  }
  if (obj.target?.entity_id !== undefined) {
    const val = obj.target.entity_id;
    if (typeof val === 'string') results.push({ path: `${path}.target.entity_id`, entityId: val });
    else if (Array.isArray(val)) val.forEach((eid: string, i: number) => {
      if (typeof eid === 'string') results.push({ path: `${path}.target.entity_id[${i}]`, entityId: eid });
    });
  }
  for (const key of Object.keys(obj)) {
    if (key === 'entity_id' || key === 'target') continue;
    results.push(...extractEntityIds(obj[key], path ? `${path}.${key}` : key));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Levenshtein distance + closest-entity finder
// ─────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function findClosest(unknown: string, knownIds: string[]): { id: string; dist: number } | undefined {
  const domain = unknown.split('.')[0];
  const pool = knownIds.filter(id => id.startsWith(domain + '.'));
  let best: string | undefined, bestDist = Infinity;
  for (const id of (pool.length > 0 ? pool : knownIds)) {
    const d = levenshtein(unknown, id);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best ? { id: best, dist: bestDist } : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep-replace all occurrences of an entity ID string inside an object tree
// ─────────────────────────────────────────────────────────────────────────────

function deepReplaceEntityId(obj: any, from: string, to: string): any {
  if (typeof obj === 'string') return obj === from ? to : obj;
  if (Array.isArray(obj)) return obj.map(item => deepReplaceEntityId(item, from, to));
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = deepReplaceEntityId(obj[k], from, to);
    return out;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE YAML NORMALISER
// Fixes common AI mistakes in-place before validation, no AI call needed.
// ─────────────────────────────────────────────────────────────────────────────

export class YAMLNormaliser {
  /**
   * Normalise a single tool call's arguments:
   * 1. Fix plural HA keys → singular  (triggers→trigger, actions→action, conditions→condition)
   * 2. Inject default mode if missing
   * 3. Deduplicate entity_id arrays
   * Returns a new (possibly modified) toolCall.
   */
  public static normalise(tc: AIToolCall): AIToolCall {
    if (tc.name !== 'create_or_update_automation') return tc;
    let args = { ...tc.arguments };

    // 1. Plural → singular key normalisation
    // AI often outputs "triggers:", "actions:", "conditions:" — HA only accepts singular
    const keyMap: Record<string, string> = {
      triggers: 'trigger',
      actions: 'action',
      conditions: 'condition',
      // Also handle common variations
      trigger: 'trigger',
      action: 'action',
      condition: 'condition'
    };
    for (const [plural, singular] of Object.entries(keyMap)) {
      if (plural !== singular && plural in args) {
        // Merge if singular already exists (unlikely but safe)
        if (!(singular in args)) args[singular] = args[plural];
        delete args[plural];
      }
    }

    // 2. Ensure trigger/condition/action are always arrays (AI sometimes outputs single objects)
    for (const field of ['trigger', 'condition', 'action'] as const) {
      if (args[field] !== undefined && !Array.isArray(args[field])) {
        args[field] = [args[field]];
      }
      if (args[field] === undefined) args[field] = [];
    }

    // 3. Inject default mode if missing (HA default is 'single', be explicit)
    if (!args.mode) args.mode = 'single';

    // 4. Deduplicate entity_id arrays in trigger/condition/action targets
    args = deepDedupeEntityIds(args);

    return { ...tc, arguments: args };
  }

  public static normaliseBatch(toolCalls: AIToolCall[]): AIToolCall[] {
    return toolCalls.map(tc => this.normalise(tc));
  }
}

function deepDedupeEntityIds(obj: any): any {
  if (Array.isArray(obj)) return obj.map(deepDedupeEntityIds);
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      if ((k === 'entity_id') && Array.isArray(obj[k])) {
        // Deduplicate while preserving order
        out[k] = [...new Set(obj[k])];
      } else {
        out[k] = deepDedupeEntityIds(obj[k]);
      }
    }
    return out;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML VALIDATOR + AUTO-FIXER
// Post-generation fact-checker. For near-exact typos (Levenshtein ≤ 2),
// patches the entity ID directly in the arguments — no AI retry needed.
// Only truly unknown entities (dist > 2) escalate to an AI retry.
// ─────────────────────────────────────────────────────────────────────────────

export class YAMLValidator {
  /** Levenshtein threshold below which we auto-patch without an AI call */
  private static readonly AUTO_FIX_THRESHOLD = 2;

  public static validate(toolCall: AIToolCall): { toolCall: AIToolCall; result: ValidationResult } {
    const twin = StorageService.getDigitalTwin();
    if (!twin || !twin.states || twin.states.length === 0) {
      return {
        toolCall,
        result: { isClean: true, unknownEntities: [], checkedEntityCount: 0, autoFixedCount: 0 }
      };
    }

    const knownIds = new Set(twin.states.map(s => s.entity_id));
    const knownIdList = Array.from(knownIds);
    const { trigger = [], condition = [], action = [] } = toolCall.arguments;

    const allRefs = [
      ...extractEntityIds(trigger, 'trigger'),
      ...extractEntityIds(condition, 'condition'),
      ...extractEntityIds(action, 'action'),
    ];

    const unknownEntities: ValidationWarning[] = [];
    const seen = new Set<string>();
    let patchedArgs = { ...toolCall.arguments };
    let autoFixedCount = 0;

    for (const { path, entityId } of allRefs) {
      if (seen.has(entityId)) continue;
      seen.add(entityId);
      if (entityId.includes('{{') || entityId === 'all' || !entityId.includes('.')) continue;
      if (knownIds.has(entityId)) continue;

      const closest = findClosest(entityId, knownIdList);

      if (closest && closest.dist <= this.AUTO_FIX_THRESHOLD) {
        // ── CLIENT-SIDE AUTO-FIX: typo close enough to patch without AI ──
        console.log(`[HAAI AutoFix] "${entityId}" → "${closest.id}" (dist=${closest.dist})`);
        patchedArgs = deepReplaceEntityId(patchedArgs, entityId, closest.id);
        autoFixedCount++;
        unknownEntities.push({ entityId, usedIn: path, suggestion: closest.id, autoFixed: true });
        // Update known set so we don't flag the corrected ID on next pass
        knownIds.add(closest.id);
      } else {
        // Genuinely unknown — needs AI retry
        unknownEntities.push({ entityId, usedIn: path, suggestion: closest?.id });
      }
    }

    const unfixedCount = unknownEntities.filter(w => !w.autoFixed).length;

    return {
      toolCall: { ...toolCall, arguments: patchedArgs },
      result: {
        isClean: unfixedCount === 0,
        unknownEntities,
        checkedEntityCount: seen.size,
        autoFixedCount
      }
    };
  }

  /**
   * Validate and auto-fix a batch of tool calls.
   * Returns patched tool calls with _validation annotations.
   */
  public static validateBatch(toolCalls: AIToolCall[]): AIToolCall[] {
    return toolCalls.map(tc => {
      if (tc.name !== 'create_or_update_automation') return tc;
      const { toolCall: patched, result } = this.validate(tc);
      return { ...patched, _validation: result };
    });
  }
}
