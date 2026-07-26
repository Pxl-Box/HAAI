import { AIProviderConfig, AIProviderId, ChatMessage, AIToolCall } from '../../types/ai';
import { HA_TOOLS, executeHATool } from '../haTools';
import { StorageService } from '../storage';
import { SYSTEM_PROMPT } from './systemPrompt';
import { LocalPreProcessor } from '../localPreProcessor';
import { YAMLValidator, YAMLNormaliser } from './yamlValidator';
import { haService } from '../haClient';
import yaml from 'yaml';


export const DEFAULT_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local LLM)',
    isLocal: true,
    baseUrl: 'http://localhost:11434',
    selectedModel: 'llama3.2',
    availableModels: ['llama3.2', 'llama3.1', 'qwen2.5', 'deepseek-r1', 'mistral', 'gemma2']
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio (Local Server)',
    isLocal: true,
    baseUrl: 'http://localhost:1234/v1',
    selectedModel: 'local-model',
    availableModels: ['local-model']
  },
  jan: {
    id: 'jan',
    name: 'Jan.ai / LocalAI / Kobold',
    isLocal: true,
    baseUrl: 'http://localhost:1337/v1',
    selectedModel: 'jan-local',
    availableModels: ['jan-local']
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode / Custom Endpoint',
    isLocal: false,
    baseUrl: 'http://localhost:8080/v1',
    selectedModel: 'default',
    availableModels: ['default']
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT-4o / o-series)',
    isLocal: false,
    baseUrl: 'https://api.openai.com/v1',
    selectedModel: 'gpt-4o',
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini']
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    isLocal: false,
    baseUrl: 'https://api.anthropic.com/v1',
    selectedModel: 'claude-3-5-sonnet-20241022',
    availableModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    isLocal: false,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    selectedModel: 'gemini-2.0-flash',
    availableModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-pro-exp']
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek API',
    isLocal: false,
    baseUrl: 'https://api.deepseek.com/v1',
    selectedModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud Inference',
    isLocal: false,
    baseUrl: 'https://api.groq.com/openai/v1',
    selectedModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b']
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Multi-Model)',
    isLocal: false,
    baseUrl: 'https://openrouter.ai/api/v1',
    selectedModel: 'anthropic/claude-3.5-sonnet',
    availableModels: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct']
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    isLocal: false,
    baseUrl: 'https://api.mistral.ai/v1',
    selectedModel: 'mistral-large-latest',
    availableModels: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest']
  }
};

export class AIManager {
  public static async testProviderConnection(provider: AIProviderConfig): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      if (provider.id === 'ollama') {
        const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/api/tags`);
        if (!res.ok) return { success: false, message: `Ollama connection error: ${res.statusText}` };
        const data = await res.json();
        const models = data.models ? data.models.map((m: any) => m.name) : provider.availableModels;
        return { success: true, message: `Connected to local Ollama (${models.length} models found)!`, models };
      }

      if (provider.id === 'gemini') {
        if (!provider.apiKey) {
          return { success: false, message: 'Google Gemini requires an API key.' };
        }
        const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models?key=${provider.apiKey}`);
        if (!res.ok) {
          return { success: false, message: `Gemini API returned HTTP ${res.status}. Check if your API key is valid.` };
        }
        const data = await res.json();
        const models = data.models
          ? data.models.map((m: any) => m.name.replace('models/', ''))
          : provider.availableModels;
        return { success: true, message: `Connected to Google Gemini (${models.length} models available)!`, models };
      }

      if (provider.id === 'claude') {
        if (!provider.apiKey) {
          return { success: false, message: 'Anthropic Claude requires an API key.' };
        }
        return { success: true, message: `Configured Anthropic Claude with provided API key!` };
      }

      if (provider.baseUrl.includes('/v1') || provider.id === 'openai' || provider.id === 'groq' || provider.id === 'deepseek' || provider.id === 'lmstudio') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

        const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, { headers });
        if (!res.ok && res.status !== 404) {
          return { success: false, message: `Server returned status ${res.status}` };
        }
        if (res.ok) {
          const data = await res.json();
          const models = data.data ? data.data.map((m: any) => m.id) : provider.availableModels;
          return { success: true, message: `Connected to ${provider.name}!`, models };
        }
      }

      return { success: true, message: `Configured ${provider.name} endpoint.` };
    } catch (err: any) {
      return { success: false, message: err.message || `Failed to connect to ${provider.name}.` };
    }
  }

  private static async autoSyncGeneratedAutomations(text: string): Promise<AIToolCall[]> {
    const yamlRegex = /```(?:yaml|yml)?\s*([\s\S]*?)```/gi;
    const toolCallsMap = new Map<string, AIToolCall>();
    let match;

    while ((match = yamlRegex.exec(text)) !== null) {
      try {
        const parsed = yaml.parse(match[1]);
        
        // Handle array of automations inside a single YAML code block
        const items = Array.isArray(parsed) ? parsed : [parsed];

        items.forEach((item: any) => {
          if (item && (item.alias || item.id || item.trigger || item.action)) {
            const aliasKey = (item.alias || 'automation').toLowerCase().replace(/[^a-z0-9]/g, '_');
            const autoId = item.id || `automation_${aliasKey}`;
            const uniqueCallId = `call_${autoId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            
            const toolCall: AIToolCall = {
              id: uniqueCallId,
              name: 'create_or_update_automation',
              arguments: {
                automationId: autoId,
                alias: item.alias || 'Smart Automation',
                description: item.description || '',
                trigger: Array.isArray(item.trigger) ? item.trigger : (item.trigger ? [item.trigger] : []),
                condition: Array.isArray(item.condition) ? item.condition : (item.condition ? [item.condition] : []),
                action: Array.isArray(item.action) ? item.action : (item.action ? [item.action] : []),
                disableLegacyEntityIds: item.disableLegacyEntityIds || item.disable_legacy_entity_ids || item.disable_legacy || []
              }
            };

            toolCallsMap.set(autoId, toolCall);
          }
        });
      } catch (e) {
        // Skip non-automation YAML blocks
      }
    }

    return Array.from(toolCallsMap.values());
  }

  /**
   * Parses structured JSON tool-call directives from the AI response text.
   * These are used for non-automation tools (floor, area, assignment operations)
   * that do not have a YAML representation.
   *
   * The AI emits these in fenced ```json blocks with this contract:
   *   { "tool": "<tool_name>", "args": { ...tool arguments... } }
   * or an array of such objects for batch operations:
   *   [ { "tool": "...", "args": {...} }, ... ]
   *
   * Supported tools: get_areas_and_floors, create_or_update_floor,
   *                  create_or_update_area, assign_to_area,
   *                  call_ha_service, disable_automation
   */
  private static parseStructuredToolDirectives(text: string): AIToolCall[] {
    const SUPPORTED_TOOLS = new Set([
      'get_areas_and_floors',
      'create_or_update_floor',
      'create_or_update_area',
      'assign_to_area',
      'call_ha_service',
      'disable_automation',
      'get_entities',
      'create_new_dashboard',
      'get_dashboard_config',
      'update_dashboard_config',
      'analyze_entity_rename_safety'
    ]);

    const jsonRegex = /```json\s*([\s\S]*?)```/gi;
    const toolCalls: AIToolCall[] = [];
    let match;

    while ((match = jsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const items: any[] = Array.isArray(parsed) ? parsed : [parsed];

        items.forEach((item: any) => {
          if (!item || typeof item.tool !== 'string') return;
          if (!SUPPORTED_TOOLS.has(item.tool)) return;
          const args = item.args || {};
          const uniqueId = `call_${item.tool}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          toolCalls.push({ id: uniqueId, name: item.tool, arguments: args });
        });
      } catch {
        // Skip malformed JSON blocks
      }
    }

    return toolCalls;
  }

  /** Maximum automatic correction retries when validation finds unknown entities */
  private static readonly MAX_VALIDATION_RETRIES = 2;

  /**
   * Low-level: call the configured provider with a pre-built conversation.
   * Returns raw response text only — no YAML parsing.
   */
  private static async callProvider(
    provider: AIProviderConfig,
    systemPrompt: string,
    messages: ChatMessage[]
  ): Promise<string> {
    // 1. Google Gemini
    if (provider.id === 'gemini') {
      const modelName = provider.selectedModel || 'gemini-2.0-flash';
      const url = `${provider.baseUrl.replace(/\/$/, '')}/models/${modelName}:generateContent?key=${provider.apiKey}`;
      const contents = messages.map(msg => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.role === 'user' && msg.imageUrls && msg.imageUrls.length > 0) {
          msg.imageUrls.forEach(img => {
            const base64Data = img.split(',')[1] || img;
            const mimeType = img.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
            parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
          });
        }
        return { role: msg.role === 'user' ? 'user' : 'model', parts };
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.3 }
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        if (response.status === 429 || errMsg.toLowerCase().includes('quota')) {
          throw new Error('API Quota Exceeded. Please wait a moment or switch to another AI model in Settings.');
        }
        throw new Error(`Gemini API Error ${response.status}: ${errMsg}`);
      }
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // 2. OpenAI-compatible APIs
    if (
      provider.id === 'openai' || provider.id === 'deepseek' || provider.id === 'groq' ||
      provider.id === 'openrouter' || provider.id === 'lmstudio' || provider.id === 'opencode'
    ) {
      const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
      const msgPayload = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => {
          if (msg.role === 'user' && msg.imageUrls && msg.imageUrls.length > 0) {
            const contentParts: any[] = [{ type: 'text', text: msg.content }];
            msg.imageUrls.forEach(u => contentParts.push({ type: 'image_url', image_url: { url: u } }));
            return { role: 'user', content: contentParts };
          }
          return { role: msg.role, content: msg.content };
        })
      ];
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: provider.selectedModel, messages: msgPayload, temperature: 0.3 })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
          throw new Error('API Quota Exceeded. Please wait a moment or switch to another AI model in Settings.');
        }
        throw new Error(`${provider.name} returned error ${response.status}: ${errMsg}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }

    // 3. Ollama
    if (provider.id === 'ollama') {
      const url = `${provider.baseUrl.replace(/\/$/, '')}/api/chat`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: provider.selectedModel,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false
        })
      });
      if (!response.ok) throw new Error(`Ollama returned error ${response.status}`);
      const data = await response.json();
      return data.message?.content || '';
    }

    return `As your Home Assistant AI Agent powered by **${provider.name}** (${provider.selectedModel}), I checked your live instance.`;
  }

  /**
   * Build a targeted correction prompt when validation finds unknown entity IDs.
   * Lists exactly what is wrong and provides real alternatives from the Digital Twin.
   */
  private static buildCorrectionPrompt(toolCalls: AIToolCall[]): string {
    const twin = StorageService.getDigitalTwin();
    const knownIds = twin?.states?.map(s => s.entity_id) || [];
    const issues: string[] = [];

    for (const tc of toolCalls) {
      const v = tc._validation;
      if (!v || v.isClean) continue;
      issues.push(`Automation "${tc.arguments?.alias || tc.arguments?.automationId}":`);
      for (const w of v.unknownEntities) {
        const domain = w.entityId.split('.')[0];
        const domainEntities = knownIds.filter(id => id.startsWith(domain + '.')).slice(0, 6).join(', ');
        issues.push(
          `  - "${w.entityId}" (used in ${w.usedIn}) does NOT exist in this Home Assistant instance.` +
          (w.suggestion ? ` Closest real match: "${w.suggestion}".` : '') +
          (domainEntities ? ` Real ${domain} entities available: ${domainEntities}` : '')
        );
      }
    }

    return `ENTITY VALIDATION FAILED — PLEASE CORRECT AND REGENERATE:

Your previous output contained entity IDs that do not exist in the user's Home Assistant Digital Twin.
Fix the following issues:

${issues.join('\n')}

Instructions:
- Replace every flagged entity ID with an exact real entity ID from the alternatives listed above or the Digital Twin context.
- Do NOT invent new entity IDs. If you cannot find a suitable real entity, say so explicitly.
- Output corrected yaml code blocks for ALL affected automations in full.`;
  }

  public static async sendMessage(
    provider: AIProviderConfig,
    history: ChatMessage[],
    userMessage: string,
    imageUrls?: string[]
  ): Promise<{ responseText: string; toolCalls?: AIToolCall[] }> {
    const localHAContext = await LocalPreProcessor.getContextForPrompt(userMessage);

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nActive AI Provider: ${provider.name} (${provider.selectedModel})\n\n${localHAContext}
CRITICAL NO-GUESSING & MULTIMODAL DIRECTIVE:
1. When user uploads a screenshot, carefully inspect the Home Assistant UI, trace logs, or error popups in the image to accurately identify and resolve issues!
2. NEVER guess entity IDs or invent placeholder triggers/actions. If a referenced automation or entity is not in your context, follow your Intent Protocol and ask the user for clarification!
3. OUTPUT EACH AUTOMATION IN ITS OWN SEPARATE \`\`\`yaml CODE BLOCK so HAAI generates an individual Action Card for every item!`;

    try {
      // ── GENERATION → VALIDATE → AUTO-CORRECT RETRY LOOP ────────────────────
      // The AI generates freely with no entity restrictions.
      // After each generation the YAMLValidator cross-checks all entity_id
      // references against the live Digital Twin. If unknowns are found, the
      // system automatically builds a targeted correction prompt and re-asks
      // the AI — up to MAX_VALIDATION_RETRIES times — before serving the user.
      // ────────────────────────────────────────────────────────────────────────

      let currentHistory = [...history];
      let responseText = '';
      let toolCalls: AIToolCall[] = [];

      for (let attempt = 0; attempt <= this.MAX_VALIDATION_RETRIES; attempt++) {
        responseText = await this.callProvider(provider, fullSystemPrompt, currentHistory);

        const rawToolCalls = await this.autoSyncGeneratedAutomations(responseText);
        // Also parse JSON-directive tool calls (floors, areas, assignments, service calls)
        const structuredToolCalls = this.parseStructuredToolDirectives(responseText);
        // Step 1: Client-side normalise — fixes plural HA keys (triggers→trigger),
        // injects missing mode defaults, deduplicates entity_id arrays. Zero AI calls.
        const normalisedToolCalls = YAMLNormaliser.normaliseBatch([...rawToolCalls, ...structuredToolCalls]);
        // Step 2: Validate + auto-fix — patches near-exact typos (Levenshtein ≤2)
        // directly in the arguments. Only genuinely unknown IDs escalate to AI retry.
        toolCalls = YAMLValidator.validateBatch(normalisedToolCalls);

        const hasFailures = toolCalls.some(tc => tc._validation && !tc._validation.isClean);

        // All entity IDs verified — done
        if (!hasFailures) break;

        // Exhausted retries — serve result with warning badges so user can review
        if (attempt >= this.MAX_VALIDATION_RETRIES) {
          console.warn(`[HAAI Validator] Still failing after ${attempt} retries. Serving with warnings.`);
          break;
        }

        // Build targeted correction and re-ask the AI
        const correctionPrompt = this.buildCorrectionPrompt(toolCalls);
        console.log(`[HAAI Validator] Attempt ${attempt + 1} failed. Auto-correcting...`);

        currentHistory = [
          ...currentHistory,
          { id: `retry-ai-${attempt}`, role: 'assistant' as const, content: responseText, timestamp: new Date().toISOString() },
          { id: `retry-fix-${attempt}`, role: 'user' as const, content: correctionPrompt, timestamp: new Date().toISOString() }
        ];
      }

      if (!responseText && toolCalls.length > 0) {
        responseText = `I have updated your Home Assistant automation configuration!`;
      } else if (!responseText) {
        responseText = `Processed your request with live Home Assistant local telemetry.`;
      }

      return { responseText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    } catch (err: any) {
      console.error('LLM API Call Error:', err);
      const isQuota = err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('429');
      return {
        responseText: isQuota
          ? `Quota reached. Please wait a moment or switch to another model in Settings.`
          : `Error from ${provider.name}: ${err.message || 'API request failed'}.`
      };
    }
  }
}
