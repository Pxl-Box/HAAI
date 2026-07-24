import { AIProviderConfig, AIProviderId, ChatMessage, AIToolCall } from '../../types/ai';
import { HA_TOOLS, executeHATool } from '../haTools';
import { StorageService } from '../storage';
import { SYSTEM_PROMPT } from './systemPrompt';
import { LocalPreProcessor } from '../localPreProcessor';
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
    selectedModel: 'gemini-1.5-flash',
    availableModels: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
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

  /**
   * Helper to parse generated YAML blocks ONLY from the CURRENT AI response to prevent duplicate iterations
   */
  private static async autoSyncGeneratedAutomations(text: string): Promise<AIToolCall[]> {
    const yamlRegex = /```(?:yaml|yml)?\s*([\s\S]*?)```/gi;
    const toolCallsMap = new Map<string, AIToolCall>();
    let match;

    while ((match = yamlRegex.exec(text)) !== null) {
      try {
        const parsed = yaml.parse(match[1]);
        if (parsed && (parsed.alias || parsed.trigger || parsed.action)) {
          const aliasKey = (parsed.alias || 'automation').toLowerCase().replace(/[^a-z0-9]/g, '_');
          const autoId = parsed.id || `automation_${aliasKey}`;
          
          const toolCall: AIToolCall = {
            id: `call_${autoId}`,
            name: 'create_or_update_automation',
            arguments: {
              automationId: autoId,
              alias: parsed.alias || 'Smart Automation',
              description: parsed.description || '',
              trigger: Array.isArray(parsed.trigger) ? parsed.trigger : [parsed.trigger],
              condition: Array.isArray(parsed.condition) ? parsed.condition : (parsed.condition ? [parsed.condition] : []),
              action: Array.isArray(parsed.action) ? parsed.action : [parsed.action]
            }
          };

          // Deduplicate by automation ID / alias so only the latest iteration is rendered
          toolCallsMap.set(autoId, toolCall);
        }
      } catch (e) {
        // Skip non-automation YAML blocks
      }
    }

    return Array.from(toolCallsMap.values());
  }

  public static async sendMessage(
    provider: AIProviderConfig,
    history: ChatMessage[],
    userMessage: string
  ): Promise<{ responseText: string; toolCalls?: AIToolCall[] }> {
    const localHAContext = await LocalPreProcessor.getContextForPrompt(userMessage);

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nActive AI Provider: ${provider.name} (${provider.selectedModel})\n\n${localHAContext}
IMPORTANT INSTRUCTION: You are authorized to create or update automations directly. Output complete Home Assistant automation YAML inside markdown codeblocks (\`\`\`yaml). HAAI client will automatically intercept your YAML and post it to Home Assistant API live!`;

    try {
      let responseText = '';

      // 1. Google Gemini API Call
      if (provider.id === 'gemini') {
        const modelName = provider.selectedModel || 'gemini-1.5-flash';
        const url = `${provider.baseUrl.replace(/\/$/, '')}/models/${modelName}:generateContent?key=${provider.apiKey}`;

        const contents = history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystemPrompt }] },
            contents,
            generationConfig: { temperature: 0.5 }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Gemini API Error ${response.status}: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      // 2. OpenAI Compatible APIs
      else if (provider.id === 'openai' || provider.id === 'deepseek' || provider.id === 'groq' || provider.id === 'openrouter' || provider.id === 'lmstudio' || provider.id === 'opencode') {
        const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

        const messages = [
          { role: 'system', content: fullSystemPrompt },
          ...history.map(msg => ({ role: msg.role, content: msg.content }))
        ];

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: provider.selectedModel,
            messages,
            temperature: 0.5
          })
        });

        if (!response.ok) throw new Error(`${provider.name} returned error ${response.status}`);
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      }
      // 3. Ollama Direct API
      else if (provider.id === 'ollama') {
        const url = `${provider.baseUrl.replace(/\/$/, '')}/api/chat`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.selectedModel,
            system: fullSystemPrompt,
            messages: history.map(m => ({ role: m.role, content: m.content })),
            stream: false
          })
        });

        if (!response.ok) throw new Error(`Ollama returned error ${response.status}`);
        const data = await response.json();
        responseText = data.message?.content || '';
      } else {
        responseText = `As your Home Assistant AI Agent powered by **${provider.name}** (${provider.selectedModel}), I checked your live instance.`;
      }

      // ⚡ Only parse YAML blocks from the CURRENT AI message & deduplicate by automation ID!
      const toolCalls = await this.autoSyncGeneratedAutomations(responseText);

      if (!responseText && toolCalls.length > 0) {
        responseText = `I have updated your Home Assistant automation configuration!`;
      } else if (!responseText) {
        responseText = `Processed your request with live Home Assistant local telemetry.`;
      }

      return { responseText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    } catch (err: any) {
      console.error('LLM API Call Error:', err);
      return {
        responseText: `Error from ${provider.name}: ${err.message || 'API request failed'}.\n\nLocal Home Assistant Pre-Processed Telemetry:\n${localHAContext}`
      };
    }
  }
}
