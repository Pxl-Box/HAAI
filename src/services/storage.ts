import { HAConfig, HAState, HADevice, HAArea, HAFloor, HAAutomation, HALovelaceConfig, HACSPlugin } from '../types/homeassistant';

import { SlashCommand } from '../types/slashCommands';

const STORAGE_KEYS = {
  HA_CONFIG: 'haai_ha_config',
  AI_PROVIDERS: 'haai_ai_providers',
  ACTIVE_PROVIDER: 'haai_active_provider',
  CHAT_THREADS: 'haai_chat_threads',
  ACTIVE_THREAD_ID: 'haai_active_thread_id',
  DIGITAL_TWIN: 'haai_digital_twin_cache',
  READ_ONLY_MODE: 'haai_read_only_mode',
  BRAIN_MEMORY: 'haai_brain_memory',
  CUSTOM_SLASH_COMMANDS: 'haai_custom_slash_commands'
};

export interface HADigitalTwin {
  lastUpdated: string;
  states: HAState[];
  lovelaceConfig: HALovelaceConfig | null;
  automationConfigs: Record<string, any>;
  areas?: HAArea[];
  floors?: HAFloor[];
  devices?: HADevice[];
  entityRegistry?: any[];
  integrations?: any[];
  services?: any[];
  brainMemory?: string[];
  entityCount: number;
}

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

  // --- DIGITAL TWIN SOURCE OF TRUTH LOCAL CACHE & FILE SYSTEM PERSISTENCE ---
  static getDigitalTwin(): HADigitalTwin | null {
    const raw = localStorage.getItem(STORAGE_KEYS.DIGITAL_TWIN);
    return raw ? JSON.parse(raw) : null;
  }

  static saveDigitalTwin(twin: HADigitalTwin): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DIGITAL_TWIN, JSON.stringify(twin));
    } catch (e) {
      console.warn('Digital Twin local cache quota alert, saving essential entities.', e);
    }

    // Persist to user's Documents/HAAI_Digital_Twin directory via Electron IPC
    if ((window as any).electronAPI?.saveDigitalTwinFiles) {
      (window as any).electronAPI.saveDigitalTwinFiles(twin).then((res: any) => {
        if (res?.success) {
          console.log(`[Digital Twin] Successfully saved to Documents directory: ${res.dirPath}`);
        }
      }).catch((err: any) => {
        console.warn('Failed to write Digital Twin to Documents folder:', err);
      });
    }
  }

  static getReadOnlyMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.READ_ONLY_MODE) === 'true';
  }

  static setReadOnlyMode(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEYS.READ_ONLY_MODE, String(enabled));
  }

  // --- BRAIN MEMORY (AI PERSISTENT LEARNING - IMMUNE TO CLEARS & MODEL SWITCHES) ---
  static getBrainMemory(): string[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BRAIN_MEMORY);
    let memories: string[] = raw ? JSON.parse(raw) : [];

    // Fallback recovery: if localStorage was cleared, recover brain memory from Digital Twin cache
    if (memories.length === 0) {
      const twin = this.getDigitalTwin();
      if (twin?.brainMemory && twin.brainMemory.length > 0) {
        memories = twin.brainMemory;
        localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(memories));
      }
    }
    return memories;
  }

  static addBrainMemoryItem(fact: string): string[] {
    const existing = this.getBrainMemory();
    const cleanFact = fact.trim();
    if (!cleanFact || existing.includes(cleanFact)) return existing;
    const updated = [cleanFact, ...existing];
    localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(updated));

    // Also trigger save of Digital Twin to refresh brain.md file in Documents folder
    const twin = this.getDigitalTwin();
    if (twin) {
      twin.brainMemory = updated;
      this.saveDigitalTwin(twin);
    }
    return updated;
  }

  static updateBrainMemoryItem(index: number, newFact: string): string[] {
    const existing = this.getBrainMemory();
    if (index < 0 || index >= existing.length) return existing;
    const cleanFact = newFact.trim();
    if (!cleanFact) return existing;
    existing[index] = cleanFact;
    localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(existing));

    const twin = this.getDigitalTwin();
    if (twin) {
      twin.brainMemory = existing;
      this.saveDigitalTwin(twin);
    }
    return existing;
  }

  static removeBrainMemoryItem(index: number): string[] {
    const existing = this.getBrainMemory();
    const updated = existing.filter((_, i) => i !== index);
    localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(updated));

    const twin = this.getDigitalTwin();
    if (twin) {
      twin.brainMemory = updated;
      this.saveDigitalTwin(twin);
    }
    return updated;
  }

  static clearBrainMemory(): void {
    localStorage.removeItem(STORAGE_KEYS.BRAIN_MEMORY);
    const twin = this.getDigitalTwin();
    if (twin) {
      twin.brainMemory = [];
      this.saveDigitalTwin(twin);
    }
  }

  static importBrainMemory(items: string[]): string[] {
    const current = this.getBrainMemory();
    const cleanNew = items.map(i => i.trim()).filter(Boolean);
    const combined = Array.from(new Set([...current, ...cleanNew]));
    localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(combined));

    const twin = this.getDigitalTwin();
    if (twin) {
      twin.brainMemory = combined;
      this.saveDigitalTwin(twin);
    }
    return combined;
  }

  // --- CUSTOM SLASH COMMANDS MANAGEMENT ---
  static getCustomSlashCommands(): SlashCommand[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SLASH_COMMANDS);
    return raw ? JSON.parse(raw) : [];
  }

  static saveCustomSlashCommands(commands: SlashCommand[]): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SLASH_COMMANDS, JSON.stringify(commands));
  }

  static addCustomSlashCommand(cmd: SlashCommand): SlashCommand[] {
    const existing = this.getCustomSlashCommands();
    const cleanCmd: SlashCommand = {
      ...cmd,
      name: cmd.name.replace(/^\/+/, '').trim().toLowerCase(),
      isCustom: true
    };
    const updated = [...existing.filter(c => c.name !== cleanCmd.name && c.id !== cleanCmd.id), cleanCmd];
    this.saveCustomSlashCommands(updated);
    return updated;
  }

  static updateCustomSlashCommand(id: string, updatedCmd: Partial<SlashCommand>): SlashCommand[] {
    const existing = this.getCustomSlashCommands();
    const updated = existing.map(cmd => {
      if (cmd.id === id) {
        return {
          ...cmd,
          ...updatedCmd,
          name: (updatedCmd.name || cmd.name).replace(/^\/+/, '').trim().toLowerCase()
        };
      }
      return cmd;
    });
    this.saveCustomSlashCommands(updated);
    return updated;
  }

  static deleteCustomSlashCommand(id: string): SlashCommand[] {
    const existing = this.getCustomSlashCommands();
    const updated = existing.filter(cmd => cmd.id !== id);
    this.saveCustomSlashCommands(updated);
    return updated;
  }

  /**
   * Resets local app configuration and cached twin, BUT IMMUTABLY PRESERVES THE AI BRAIN MEMORY.
   */
  static clearAll(): void {
    const brainBackup = this.getBrainMemory();
    const customCmds = this.getCustomSlashCommands();
    localStorage.clear();
    if (brainBackup && brainBackup.length > 0) {
      localStorage.setItem(STORAGE_KEYS.BRAIN_MEMORY, JSON.stringify(brainBackup));
    }
    if (customCmds && customCmds.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_SLASH_COMMANDS, JSON.stringify(customCmds));
    }
  }
}
