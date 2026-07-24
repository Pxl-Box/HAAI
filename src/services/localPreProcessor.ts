import { haService } from './haClient';
import { HAState } from '../types/homeassistant';

export interface HAIndex {
  entitiesByDomain: Record<string, HAState[]>;
  allEntities: HAState[];
  automations: HAState[];
  scripts: HAState[];
  scenes: HAState[];
  areas: Record<string, string[]>;
  hacsComponents: string[];
  healthStatus: {
    offlineCount: number;
    staleCount: number;
    batteryLowCount: number;
  };
  lastIndexed: number;
}

export interface InferredDevice {
  inferredCategory: 'Physical Light' | 'Camera Light / Infrared' | 'Switch / Plug' | 'Climate / HVAC' | 'Sensor' | 'System / Helper' | 'Zone' | 'Automation / Rule' | 'Security / Lock';
  entity_id: string;
  name: string;
  state: string;
  areaName?: string;
  originalDomain: string;
  batteryLevel?: number;
  suggestedAction?: string;
}

export class LocalPreProcessor {
  private static cache: HAIndex | null = null;
  private static CACHE_TTL_MS = 15000;

  public static async getIndex(): Promise<HAIndex> {
    const now = Date.now();
    if (this.cache && (now - this.cache.lastIndexed) < this.CACHE_TTL_MS) {
      return this.cache;
    }

    const states = await haService.getStates();
    const entitiesByDomain: Record<string, HAState[]> = {};
    const automations: HAState[] = [];
    const scripts: HAState[] = [];
    const scenes: HAState[] = [];

    let offlineCount = 0;
    let batteryLowCount = 0;

    states.forEach(s => {
      const [domain] = s.entity_id.split('.');
      if (!entitiesByDomain[domain]) entitiesByDomain[domain] = [];
      entitiesByDomain[domain].push(s);

      if (domain === 'automation') automations.push(s);
      if (domain === 'script') scripts.push(s);
      if (domain === 'scene') scenes.push(s);

      if (s.state === 'unavailable' || s.state === 'unknown') {
        offlineCount++;
      }

      if (s.attributes.battery_level !== undefined && Number(s.attributes.battery_level) < 20) {
        batteryLowCount++;
      }
    });

    this.cache = {
      entitiesByDomain,
      allEntities: states,
      automations,
      scripts,
      scenes,
      areas: {
        'Living Room': ['light.livingroom_front', 'light.livingroom_rear', 'climate.living_room_thermostat'],
        'Kitchen': ['light.kitchen_light', 'switch.kitchen_coffee_maker'],
        'Bedroom': ['light.bedroom_lights_group', 'input_boolean.bedroom_wardrobe_auto']
      },
      hacsComponents: ['Browser Mod', 'Card Mod', 'Mini Media Player', 'Mushroom Cards', 'ApexCharts Card'],
      healthStatus: {
        offlineCount,
        staleCount: 0,
        batteryLowCount
      },
      lastIndexed: now
    };

    return this.cache;
  }

  /**
   * Smart Device & Area Inference Engine
   */
  public static inferDeviceType(entity: HAState, index: HAIndex): InferredDevice {
    const id = entity.entity_id.toLowerCase();
    const name = (entity.attributes.friendly_name || entity.entity_id).toLowerCase();
    const [domain] = id.split('.');

    // Deduce Area Assignment
    let inferredArea = 'General / Unassigned';
    for (const [area, eList] of Object.entries(index.areas)) {
      if (eList.includes(entity.entity_id) || name.includes(area.toLowerCase()) || id.includes(area.toLowerCase().replace(' ', ''))) {
        inferredArea = area;
        break;
      }
    }

    const battery = entity.attributes.battery_level ? Number(entity.attributes.battery_level) : undefined;

    if (domain === 'light' && (id.includes('camera') || id.includes('ir_light') || id.includes('spotlight_camera') || name.includes('camera') || name.includes('ir light'))) {
      return {
        inferredCategory: 'Camera Light / Infrared',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain,
        batteryLevel: battery
      };
    }

    if (domain === 'light') {
      return {
        inferredCategory: 'Physical Light',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain,
        batteryLevel: battery,
        suggestedAction: `light.turn_${entity.state === 'on' ? 'off' : 'on'}: ${entity.entity_id}`
      };
    }

    if (domain === 'switch' || domain === 'input_boolean') {
      return {
        inferredCategory: 'Switch / Plug',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain,
        batteryLevel: battery
      };
    }

    if (domain === 'climate') {
      return {
        inferredCategory: 'Climate / HVAC',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain
      };
    }

    if (domain === 'lock' || domain === 'alarm_control_panel') {
      return {
        inferredCategory: 'Security / Lock',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain
      };
    }

    if (domain === 'automation') {
      return {
        inferredCategory: 'Automation / Rule',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        originalDomain: domain
      };
    }

    if (domain === 'zone') {
      return {
        inferredCategory: 'Zone',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        originalDomain: domain
      };
    }

    if (domain === 'sensor' || domain === 'binary_sensor') {
      return {
        inferredCategory: 'Sensor',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        originalDomain: domain,
        batteryLevel: battery
      };
    }

    return {
      inferredCategory: 'System / Helper',
      entity_id: entity.entity_id,
      name: entity.attributes.friendly_name || entity.entity_id,
      state: entity.state,
      originalDomain: domain
    };
  }

  /**
   * Complete Heavy Lifting Execution Pipeline
   */
  public static async getContextForPrompt(userPrompt: string): Promise<string> {
    const index = await this.getIndex();
    const categorized = index.allEntities.map(e => this.inferDeviceType(e, index));

    const physicalLights = categorized.filter(c => c.inferredCategory === 'Physical Light');
    const cameraLights = categorized.filter(c => c.inferredCategory === 'Camera Light / Infrared');
    const switches = categorized.filter(c => c.inferredCategory === 'Switch / Plug');
    const climate = categorized.filter(c => c.inferredCategory === 'Climate / HVAC');
    const security = categorized.filter(c => c.inferredCategory === 'Security / Lock');
    const automations = categorized.filter(c => c.inferredCategory === 'Automation / Rule');
    const zones = categorized.filter(c => c.inferredCategory === 'Zone');

    return `
================================================================================
PRE-PROCESSED HOME ASSISTANT LOCAL TELEMETRY & INDEX
================================================================================

1. AREA & ROOM BREAKDOWN:
   • Living Room: ${physicalLights.filter(l => l.areaName === 'Living Room').length} Lights, ${climate.filter(c => c.areaName === 'Living Room').length} Climate controls
   • Kitchen: ${physicalLights.filter(l => l.areaName === 'Kitchen').length} Lights, ${switches.filter(s => s.areaName === 'Kitchen').length} Switches
   • Bedroom: ${physicalLights.filter(l => l.areaName === 'Bedroom').length} Lights

2. SYSTEM HEALTH & DIAGNOSTICS:
   • Offline/Unavailable Devices: ${index.healthStatus.offlineCount}
   • Low Battery Warnings (<20%): ${index.healthStatus.batteryLowCount}
   • Installed HACS Custom Frontend Cards: ${index.hacsComponents.join(', ')}

3. PHYSICAL ROOM LIGHTS (${physicalLights.length} found):
${physicalLights.map(l => `  • [${l.areaName}] "${l.name}" (${l.entity_id}) -> ${l.state.toUpperCase()}`).join('\n')}

4. CAMERA LIGHTS & INFRARED LEDs (${cameraLights.length} found):
${cameraLights.map(c => `  • "${c.name}" (${c.entity_id}) -> ${c.state.toUpperCase()}`).join('\n')}

5. SWITCHES & SMART PLUGS (${switches.length} found):
${switches.map(s => `  • [${s.areaName}] "${s.name}" (${s.entity_id}) -> ${s.state.toUpperCase()}`).join('\n')}

6. CLIMATE & THERMOSTATS (${climate.length} found):
${climate.map(c => `  • [${c.areaName}] "${c.name}" (${c.entity_id}) -> ${c.state.toUpperCase()}`).join('\n')}

7. AUTOMATIONS (${automations.length} found):
${automations.map(a => `  • "${a.name}" (${a.entity_id}) -> ${a.state.toUpperCase()}`).join('\n')}

8. ZONES & PRESENCE (${zones.length} found):
${zones.map(z => `  • "${z.name}" (${z.entity_id}) -> ${z.state}`).join('\n')}
================================================================================
`;
  }
}
