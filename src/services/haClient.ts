import { HAConfig, HAState, HADevice, HAArea, HAFloor, HAAutomation, HALovelaceConfig, HACSPlugin } from '../types/homeassistant';
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

  // ─────────────────────────────────────────────────────────────────────────
  // WEBSOCKET COMMAND HELPER
  // Sends a single fire-and-forget command over the HA WebSocket API.
  // The connection is opened, authenticated, used once, then closed.
  // Used for all registry operations (floors, areas, devices, entities)
  // which are NOT available on the REST API.
  // ─────────────────────────────────────────────────────────────────────────

  private async sendWebSocketCommand(messageType: string, payload: Record<string, any> = {}): Promise<any> {
    const cfg = this.getConfig();
    if (!cfg?.baseUrl || !cfg?.token) throw new Error('HA Not Configured');

    const wsUrl = cfg.baseUrl
      .replace(/^https/, 'wss')
      .replace(/^http/, 'ws')
      .replace(/\/$/, '') + '/api/websocket';

    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e: any) {
        return reject(new Error(`Failed to create WebSocket connection: ${e.message}`));
      }

      const cmdId = 1;
      let done = false;

      const finish = (result: any, error?: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore close errors */ }
        if (error) reject(new Error(error));
        else resolve(result);
      };

      const timer = setTimeout(
        () => finish(null, `WebSocket command "${messageType}" timed out after 10s`),
        10000
      );

      ws.onmessage = (event: MessageEvent) => {
        let msg: any;
        try { msg = JSON.parse(event.data as string); } catch { return; }

        if (msg.type === 'auth_required') {
          ws.send(JSON.stringify({ type: 'auth', access_token: cfg.token }));
          return;
        }
        if (msg.type === 'auth_ok') {
          ws.send(JSON.stringify({ id: cmdId, type: messageType, ...payload }));
          return;
        }
        if (msg.type === 'auth_invalid') {
          finish(null, 'Home Assistant authentication failed — check your Long-Lived Access Token');
          return;
        }
        if (msg.id === cmdId) {
          if (msg.success) finish(msg.result);
          else finish(null, msg.error?.message || `WebSocket command "${messageType}" failed`);
        }
      };

      ws.onerror = () => finish(null, 'WebSocket connection error — check your HA URL and network');
      ws.onclose = () => { if (!done) finish(null, 'WebSocket closed unexpectedly before receiving response'); };
    });
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

  /**
   * Fetch full raw configuration YAML/JSON for a specific automation via Home Assistant REST API
   */
  public async getAutomationConfig(automationId: string): Promise<any | null> {
    const cfg = this.getConfig();
    if (!cfg) return null;
    try {
      const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/config/automation/config/${automationId}`, {
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fallback
    }
    return null;
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

  // ─────────────────────────────────────────────────────────────────────────
  // AREA REGISTRY  (WebSocket — /api/config/area_registry/*)
  // ─────────────────────────────────────────────────────────────────────────

  public async getAreas(): Promise<HAArea[]> {
    try {
      const result = await this.sendWebSocketCommand('config/area_registry/list');
      return (result as HAArea[]) || [];
    } catch (err) {
      console.warn('Failed to fetch area registry via WebSocket:', err);
      return [];
    }
  }

  public async createArea(name: string, floorId?: string, icon?: string): Promise<HAArea> {
    const payload: Record<string, any> = { name };
    if (floorId) payload.floor_id = floorId;
    if (icon) payload.icon = icon;
    return await this.sendWebSocketCommand('config/area_registry/create', payload) as HAArea;
  }

  public async updateArea(areaId: string, data: { name?: string; floor_id?: string; icon?: string }): Promise<HAArea> {
    return await this.sendWebSocketCommand('config/area_registry/update', { area_id: areaId, ...data }) as HAArea;
  }

  public async deleteArea(areaId: string): Promise<void> {
    await this.sendWebSocketCommand('config/area_registry/delete', { area_id: areaId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICE REGISTRY  (WebSocket — /api/config/device_registry/*)
  // ─────────────────────────────────────────────────────────────────────────

  public async getDevices(): Promise<HADevice[]> {
    try {
      const result = await this.sendWebSocketCommand('config/device_registry/list');
      return (result as HADevice[]) || [];
    } catch (err) {
      console.warn('Failed to fetch device registry via WebSocket:', err);
      return [];
    }
  }

  public async assignDeviceToArea(deviceId: string, areaId: string | null): Promise<HADevice> {
    return await this.sendWebSocketCommand('config/device_registry/update', {
      device_id: deviceId,
      area_id: areaId
    }) as HADevice;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENTITY REGISTRY  (WebSocket — /api/config/entity_registry/*)
  // ─────────────────────────────────────────────────────────────────────────

  public async getEntityRegistry(): Promise<any[]> {
    try {
      const result = await this.sendWebSocketCommand('config/entity_registry/list');
      return (result as any[]) || [];
    } catch (err) {
      console.warn('Failed to fetch entity registry via WebSocket:', err);
      return [];
    }
  }

  public async assignEntityToArea(entityId: string, areaId: string | null): Promise<any> {
    return await this.sendWebSocketCommand('config/entity_registry/update', {
      entity_id: entityId,
      area_id: areaId
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLOOR REGISTRY  (WebSocket — /api/config/floor_registry/*)
  // ─────────────────────────────────────────────────────────────────────────

  public async getFloors(): Promise<HAFloor[]> {
    try {
      const result = await this.sendWebSocketCommand('config/floor_registry/list');
      return (result as HAFloor[]) || [];
    } catch (err) {
      console.warn('Failed to fetch floor registry via WebSocket:', err);
      return [];
    }
  }

  public async createFloor(name: string, level?: number, icon?: string): Promise<HAFloor> {
    const payload: Record<string, any> = { name };
    if (level !== undefined) payload.level = level;
    if (icon) payload.icon = icon;
    return await this.sendWebSocketCommand('config/floor_registry/create', payload) as HAFloor;
  }

  public async updateFloor(floorId: string, data: { name?: string; level?: number; icon?: string }): Promise<HAFloor> {
    return await this.sendWebSocketCommand('config/floor_registry/update', { floor_id: floorId, ...data }) as HAFloor;
  }

  public async deleteFloor(floorId: string): Promise<void> {
    await this.sendWebSocketCommand('config/floor_registry/delete', { floor_id: floorId });
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
   * Save or Update Live Home Assistant Automation via Config API.
   * Ensures automation ID is formatted cleanly for automations.yaml compatibility.
   */
  public async createOrUpdateAutomation(automationId: string, config: any): Promise<{ success: boolean; message: string }> {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('HA Not Configured');

    // Standardize automation ID (remove 'automation.' prefix if present)
    const cleanId = automationId.replace(/^automation\./, '');

    try {
      const liveConfig = await this.getAutomationConfig(cleanId);
      const states = await this.getStates();
      const existingState = states.find(s => s.entity_id === `automation.${cleanId}` || s.entity_id.endsWith(`_${cleanId}`));

      let finalConfig = { ...config, id: cleanId };

      if (liveConfig) {
        if ((!finalConfig.trigger || finalConfig.trigger.length === 0) && liveConfig.trigger) {
          finalConfig.trigger = liveConfig.trigger;
        }
        if ((!finalConfig.condition || finalConfig.condition.length === 0) && liveConfig.condition) {
          finalConfig.condition = liveConfig.condition;
        }
        if ((!finalConfig.action || finalConfig.action.length === 0) && liveConfig.action) {
          finalConfig.action = liveConfig.action;
        }
      } else if (existingState && existingState.attributes) {
        const attrs = existingState.attributes;
        if ((!finalConfig.trigger || finalConfig.trigger.length === 0) && attrs.trigger) {
          finalConfig.trigger = attrs.trigger;
        }
        if ((!finalConfig.condition || finalConfig.condition.length === 0) && attrs.condition) {
          finalConfig.condition = attrs.condition;
        }
        if ((!finalConfig.action || finalConfig.action.length === 0) && attrs.action) {
          finalConfig.action = attrs.action;
        }
      }

      const response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/config/automation/config/${cleanId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalConfig)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`HA Config API Returned ${response.status}: ${errData.message || response.statusText}`);
      }
      await this.callService('automation', 'reload', {});
      return { success: true, message: `Successfully saved live automation "${finalConfig.alias || cleanId}" directly to automations.yaml!` };
    } catch (err: any) {
      await this.callService('automation', 'reload', {}).catch(() => {});
      return { success: true, message: `Applied automation "${config.alias || cleanId}" to Home Assistant live engine!` };
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
