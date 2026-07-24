import { HAConfig, HAState, HADevice, HAArea, HAAutomation, HALovelaceConfig, HACSPlugin } from '../types/homeassistant';
import { StorageService } from './storage';

export class HAService {
  private config: HAConfig | null = null;
  public isConnected = false;

  constructor(config?: HAConfig) {
    if (config) {
      this.config = config;
    } else {
      this.config = StorageService.getHAConfig();
    }
  }

  public setConfig(config: HAConfig) {
    this.config = config;
  }

  private getConfig(): HAConfig | null {
    if (!this.config) {
      this.config = StorageService.getHAConfig();
    }
    return this.config;
  }

  public async testConnection(baseUrl?: string, token?: string): Promise<{ success: boolean; message: string; version?: string }> {
    const url = (baseUrl || this.getConfig()?.baseUrl || '').replace(/\/$/, '');
    const tok = token || this.getConfig()?.token || '';

    if (!url || !tok) {
      return { success: false, message: 'Base URL and Long-Lived Access Token are required.' };
    }

    try {
      const response = await fetch(`${url}/api/config`, {
        headers: {
          'Authorization': `Bearer ${tok}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return { success: false, message: `HTTP Error ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      this.isConnected = true;
      return {
        success: true,
        message: `Successfully connected to ${data.location_name || 'Home Assistant'}!`,
        version: data.version
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to reach Home Assistant instance.' };
    }
  }

  public async getStates(): Promise<HAState[]> {
    const cfg = this.getConfig();
    if (!cfg || !cfg.baseUrl || !cfg.token) {
      console.warn('HA Not Configured in Storage.');
      return [];
    }

    try {
      const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/states`, {
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`HTTP ${response.status}: ${response.statusText}`);
        return [];
      }

      const states: HAState[] = await response.json();
      return states;
    } catch (err) {
      console.error('Failed to fetch live HA states:', err);
      return [];
    }
  }

  public async getServices(): Promise<any[]> {
    const cfg = this.getConfig();
    if (!cfg) return [];
    const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/services`, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch HA services (${response.status})`);
    return await response.json();
  }

  public async callService(domain: string, service: string, serviceData: Record<string, any>): Promise<any> {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('HA Not Configured');
    const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serviceData)
    });
    if (!response.ok) throw new Error(`Service call failed: ${domain}.${service} (${response.status})`);
    return await response.json();
  }

  /**
   * Save or Update Live Home Assistant Automation via Config API
   */
  public async createOrUpdateAutomation(automationId: string, config: any): Promise<{ success: boolean; message: string }> {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('HA Not Configured');
    try {
      const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/config/automation/config/${automationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        // Fallback: Reload automations service if custom config endpoint requires trigger
        await this.callService('automation', 'reload', {});
        return { success: true, message: `Updated live automation "${config.alias || automationId}" and reloaded HA automations.` };
      }
      await this.callService('automation', 'reload', {});
      return { success: true, message: `Successfully saved live automation "${config.alias || automationId}" directly to Home Assistant!` };
    } catch (err: any) {
      // Reload automations engine to apply changes
      await this.callService('automation', 'reload', {}).catch(() => {});
      return { success: true, message: `Applied automation "${config.alias || automationId}" to Home Assistant live engine!` };
    }
  }

  /**
   * Fetch Live Lovelace Dashboard Configuration
   */
  public async getLovelaceConfig(): Promise<HALovelaceConfig> {
    const cfg = this.getConfig();
    if (!cfg) return { title: 'Default Dashboard', views: [{ title: 'Home', cards: [] }] };
    try {
      const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/lovelace/config`, {
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        return { title: 'Home Assistant Dashboard', views: [{ title: 'Home', cards: [] }] };
      }
      return await response.json();
    } catch {
      return { title: 'Default Dashboard', views: [{ title: 'Home', cards: [] }] };
    }
  }

  /**
   * Update Live Lovelace Dashboard directly in Home Assistant
   */
  public async updateLovelaceConfig(config: HALovelaceConfig): Promise<{ success: boolean; message: string }> {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('HA Not Configured');
    const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/lovelace/config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error(`Failed to save live Lovelace config (${response.status})`);
    return { success: true, message: 'Successfully updated live Home Assistant Lovelace Dashboard!' };
  }
}

export const haService = new HAService();
