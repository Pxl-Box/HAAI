export type AIProviderId = 
  | 'ollama' 
  | 'lmstudio' 
  | 'jan' 
  | 'opencode' 
  | 'openai' 
  | 'claude' 
  | 'gemini' 
  | 'deepseek' 
  | 'groq' 
  | 'openrouter' 
  | 'mistral';

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  isLocal: boolean;
  baseUrl: string;
  apiKey?: string;
  selectedModel: string;
  availableModels: string[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  /** Populated after post-generation validation against the Digital Twin */
  _validation?: {
    isClean: boolean;
    unknownEntities: Array<{ entityId: string; usedIn: string; suggestion?: string }>;
    checkedEntityCount: number;
  };
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  result?: any;
  error?: string;
  diffPreview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  imageUrls?: string[];
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
  modelUsed?: string;
  providerId?: AIProviderId;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  systemPromptOverride?: string;
}
