import { HAConfig, HAState, HADevice, HAArea, HAAutomation, HALovelaceConfig, HACSPlugin } from '../types/homeassistant';

const STORAGE_KEYS = {
  HA_CONFIG: 'haai_ha_config',
  AI_PROVIDERS: 'haai_ai_providers',
  ACTIVE_PROVIDER: 'haai_active_provider',
  CHAT_THREADS: 'haai_chat_threads',
  ACTIVE_THREAD_ID: 'haai_active_thread_id'
};

export class StorageService {
  static getHAConfig(): HAConfig | null {
    const raw = localStorage.getItem(STORAGE_KEYS.HA_CONFIG);
    return raw ? JSON.parse(raw) : null;
  }

  static saveHAConfig(config: HAConfig): void {
    localStorage.setItem(STORAGE_KEYS.HA_CONFIG, JSON.stringify(config));
  }

  static getAIProviders(): Record<string, any> {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_PROVIDERS);
    return raw ? JSON.parse(raw) : {};
  }

  static saveAIProviders(providers: Record<string, any>): void {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDERS, JSON.stringify(providers));
  }

  static getActiveProviderId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER) || 'ollama';
  }

  static saveActiveProviderId(providerId: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, providerId);
  }

  static getChatThreads(): any[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_THREADS);
    return raw ? JSON.parse(raw) : [];
  }

  static saveChatThreads(threads: any[]): void {
    localStorage.setItem(STORAGE_KEYS.CHAT_THREADS, JSON.stringify(threads));
  }

  static getActiveThreadId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_THREAD_ID);
  }

  static saveActiveThreadId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_THREAD_ID, id);
  }

  static clearAll(): void {
    localStorage.clear();
  }
}
