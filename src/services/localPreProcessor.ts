import { haService } from './haClient';
import { StorageService, HADigitalTwin } from './storage';
import { HAState } from '../types/homeassistant';
import { HAKnowledgeBase } from './haKnowledgeBase';

export interface HALocalIndex {
  allEntities: HAState[];
  healthStatus: {
    offlineCount: number;
    batteryLowCount: number;
    offlineEntities: string[];
  };
  hacsComponents: string[];
}

export interface InferredDevice {
  inferredCategory: string;
  entity_id: string;
  name: string;
  state: string;
  areaName?: string;
  isAssignedToArea?: boolean;
  originalDomain: string;
  batteryLevel?: number;
  suggestedAction?: string;
  notes?: string;
  rawAttributes?: any;
  fullConfig?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFIER
// Reads the user's prompt and determines which mode the AI should operate in.
// ─────────────────────────────────────────────────────────────────────────────

export type UserIntent = 'CREATE' | 'REFACTOR' | 'EDIT' | 'READ';

export interface IntentResult {
  intent: UserIntent;
  /** Automation raw IDs (without 'automation.' prefix) that the user is referencing */
  targetAutomationIds: string[];
  /** Entity IDs mentioned in the prompt */
  targetEntityIds: string[];
  /** Human-readable summary of what was detected */
  reasoning: string;
}

const CREATE_SIGNALS = [
  'create', 'new', 'build', 'make', 'add', 'set up', 'setup', 'write',
  'automate', 'generate', 'design', 'configure', 'define', 'draft'
];

const REFACTOR_SIGNALS = [
  'refactor', 'clean', 'cleaning', 'tidy', 'organise', 'organize',
  'rename', 'restructure', 'sort', 'group', 'move to area', 'categorise',
  'categorize', 'assign to', 'ungrouped', 'sort out'
];

const EDIT_SIGNALS = [
  'edit', 'update', 'change', 'modify', 'fix', 'adjust', 'tweak',
  'repair', 'correct', 'improve', 'extend', 'append', 'add to',
  'remove from', 'replace', 'it keeps', 'broken', 'not working', 'wrong'
];

const READ_SIGNALS = [
  'list', 'show', 'display', 'get', 'view', 'what are', 'what areas',
  'what floors', 'tell me', 'find', 'check', 'summary', 'report', 'see'
];

export class IntentClassifier {
  /**
   * Classify user intent and extract referenced automation/entity IDs from the prompt
   * against the live Digital Twin.
   */
  public static classify(prompt: string, twin: HADigitalTwin): IntentResult {
    const lower = prompt.toLowerCase();

    // Score each intent category
    const createScore   = CREATE_SIGNALS.filter(w => lower.includes(w)).length;
    const refactorScore = REFACTOR_SIGNALS.filter(w => lower.includes(w)).length;
    const editScore     = EDIT_SIGNALS.filter(w => lower.includes(w)).length;
    const readScore     = READ_SIGNALS.filter(w => lower.includes(w)).length;

    let intent: UserIntent;
    if (readScore > 0 && createScore === 0 && refactorScore === 0 && editScore === 0) {
      intent = 'READ';
    } else if (refactorScore > createScore && refactorScore >= editScore) {
      intent = 'REFACTOR';
    } else if (editScore > createScore) {
      intent = 'EDIT';
    } else if (createScore > 0) {
      intent = 'CREATE';
    } else if (readScore > 0) {
      intent = 'READ';
    } else {
      intent = 'READ';
    }

    // --- Match mentioned automations ---
    const targetAutomationIds: string[] = [];
    const allAutoIds = Object.keys(twin.automationConfigs || {});

    allAutoIds.forEach(rawId => {
      const cfg = twin.automationConfigs[rawId];
      const alias = (cfg?.alias || rawId).toLowerCase();
      const rawLower = rawId.toLowerCase().replace(/_/g, ' ');
      if (lower.includes(alias) || lower.includes(rawLower) || lower.includes(rawId.replace(/_/g, ' '))) {
        targetAutomationIds.push(rawId);
      }
    });

    // Also scan automation states by friendly name
    const automationStates = (twin.states || []).filter(s => s.entity_id.startsWith('automation.'));
    automationStates.forEach(s => {
      const name = (s.attributes?.friendly_name || '').toLowerCase();
      const rawId = s.entity_id.replace('automation.', '');
      if (name && lower.includes(name) && !targetAutomationIds.includes(rawId)) {
        targetAutomationIds.push(rawId);
      }
    });

    // --- Match mentioned entity IDs ---
    const targetEntityIds: string[] = [];
    (twin.states || []).forEach(s => {
      const eid = s.entity_id.toLowerCase();
      const name = (s.attributes?.friendly_name || '').toLowerCase();
      if (lower.includes(eid) || (name.length > 3 && lower.includes(name))) {
        targetEntityIds.push(s.entity_id);
      }
    });

    const reasoning = `Intent: ${intent} | Automation matches: [${targetAutomationIds.join(', ') || 'none'}] | Entity matches: [${targetEntityIds.slice(0, 8).join(', ') || 'none'}]`;

    return { intent, targetAutomationIds, targetEntityIds, reasoning };
  }
}

export class LocalPreProcessor {
  /**
   * DIGITAL TWIN SYNCHRONIZER:
   * Fetches fresh live states, Lovelace dashboard config, and raw automation YAML configs from Home Assistant,
   * updates the local Digital Twin cache (Source of Truth), and returns the synchronized index.
   */
  public static async syncDigitalTwin(): Promise<HADigitalTwin> {
    console.log('[Digital Twin] Clearing old content and resyncing live Home Assistant Source of Truth...');

    // Fetch all source-of-truth components in parallel
    const [
      states,
      lovelaceConfig,
      areas,
      floors,
      devices,
      entityRegistry,
      integrations,
      services
    ] = await Promise.all([
      haService.getStates(),
      haService.getLovelaceConfig().catch(() => null),
      haService.getAreas().catch(() => []),
      haService.getFloors().catch(() => []),
      haService.getDevices().catch(() => []),
      haService.getEntityRegistry().catch(() => []),
      haService.getIntegrations().catch(() => []),
      haService.getServices().catch(() => [])
    ]);

    const automations = states.filter(s => s.entity_id.startsWith('automation.'));
    const automationConfigs: Record<string, any> = {};

    await Promise.all(
      automations.map(async a => {
        const rawId = a.entity_id.replace('automation.', '');
        const cfg = await haService.getAutomationConfig(rawId);
        if (cfg) {
          automationConfigs[rawId] = cfg;
        } else if (a.attributes) {
          automationConfigs[rawId] = {
            id: rawId,
            alias: a.attributes.friendly_name || rawId,
            trigger: a.attributes.trigger || [],
            condition: a.attributes.condition || [],
            action: a.attributes.action || []
          };
        }
      })
    );

    const brainMemory = StorageService.getBrainMemory();

    const twin: HADigitalTwin = {
      lastUpdated: new Date().toISOString(),
      states,
      lovelaceConfig,
      automationConfigs,
      areas,
      floors,
      devices,
      entityRegistry,
      integrations,
      services,
      brainMemory,
      entityCount: states.length
    };

    // Save fresh Digital Twin, replacing previous state completely
    StorageService.saveDigitalTwin(twin);
    console.log(`[Digital Twin] Successfully imported ${states.length} entities, ${areas.length} areas, ${floors.length} floors, ${devices.length} devices, ${integrations.length} integrations.`);
    return twin;
  }

  public static async getIndex(): Promise<HALocalIndex> {
    let twin = StorageService.getDigitalTwin();

    // If cache missing or older than 5 minutes, run live Digital Twin Sync
    if (!twin || !twin.states || twin.states.length === 0) {
      twin = await this.syncDigitalTwin();
    }

    const states = twin.states;
    const offlineEntities = states.filter(s => s.state === 'unavailable' || s.state === 'unknown');
    const batteryEntities = states.filter(s => {
      const bat = s.attributes.battery_level ?? s.attributes.battery;
      return typeof bat === 'number' && bat < 20;
    });

    const hacsCards = new Set<string>();
    states.forEach(s => {
      const str = JSON.stringify(s.attributes).toLowerCase();
      if (str.includes('mushroom')) hacsCards.add('Mushroom Cards');
      if (str.includes('card-mod') || str.includes('card_mod')) hacsCards.add('Card Mod');
      if (str.includes('mini-media-player')) hacsCards.add('Mini Media Player');
      if (str.includes('browser_mod')) hacsCards.add('Browser Mod');
      if (str.includes('apexcharts')) hacsCards.add('ApexCharts Card');
    });

    return {
      allEntities: states,
      healthStatus: {
        offlineCount: offlineEntities.length,
        batteryLowCount: batteryEntities.length,
        offlineEntities: offlineEntities.map(e => e.entity_id)
      },
      hacsComponents: Array.from(hacsCards)
    };
  }

  public static inferDeviceType(entity: HAState, index: HALocalIndex): InferredDevice {
    const twin = StorageService.getDigitalTwin();
    const entityId = entity.entity_id.toLowerCase();
    const rawFriendlyName = entity.attributes.friendly_name || '';
    const friendlyName = rawFriendlyName.toLowerCase();
    const domain = entityId.split('.')[0];
    const battery = entity.attributes.battery_level ?? entity.attributes.battery;

    let inferredArea = 'UNGROUPED (NO AREA ASSIGNED)';
    let isAssignedToArea = false;

    // 1. Official Registry Area Lookup (First Priority)
    if (twin && twin.entityRegistry && twin.areas) {
      const regEntry = twin.entityRegistry.find((e: any) => e.entity_id === entity.entity_id);
      let areaId = regEntry?.area_id;

      // Check device area if entity area not explicitly set
      if (!areaId && regEntry?.device_id && twin.devices) {
        const devEntry = twin.devices.find((d: any) => d.id === regEntry.device_id);
        areaId = devEntry?.area_id;
      }

      if (areaId) {
        const areaObj = twin.areas.find((a: any) => a.area_id === areaId);
        if (areaObj) {
          inferredArea = areaObj.name;
          isAssignedToArea = true;
        }
      }
    }

    // 2. Friendly Name / Entity ID matching against official registry areas
    if (!isAssignedToArea && twin && twin.areas && twin.areas.length > 0) {
      const matchedRegArea = twin.areas.find((a: any) => {
        const areaNameLower = a.name.toLowerCase();
        const areaIdLower = a.area_id.toLowerCase();
        return (
          friendlyName.includes(areaNameLower) ||
          entityId.includes(areaIdLower) ||
          (a.name.length > 3 && friendlyName.includes(a.name.toLowerCase()))
        );
      });

      if (matchedRegArea) {
        inferredArea = matchedRegArea.name;
        isAssignedToArea = true;
      }
    }

    // 3. Common room prefix fallback
    if (!isAssignedToArea) {
      if (rawFriendlyName.includes(':')) {
        inferredArea = rawFriendlyName.split(':')[0].trim();
        isAssignedToArea = true;
      } else if (rawFriendlyName.startsWith('[')) {
        const match = rawFriendlyName.match(/^\[(.*?)\]/);
        if (match) {
          inferredArea = match[1].trim();
          isAssignedToArea = true;
        }
      } else {
        if (entityId.includes('bedroom') || friendlyName.includes('bedroom')) { inferredArea = 'Bedroom'; isAssignedToArea = true; }
        else if (entityId.includes('sophie') || friendlyName.includes('sophie')) { inferredArea = "Sophie's Room"; isAssignedToArea = true; }
        else if (entityId.includes('living') || friendlyName.includes('living')) { inferredArea = 'Living Room'; isAssignedToArea = true; }
        else if (entityId.includes('kitchen') || friendlyName.includes('kitchen')) { inferredArea = 'Kitchen'; isAssignedToArea = true; }
        else if (entityId.includes('hallway') || friendlyName.includes('hallway')) { inferredArea = 'Hallway'; isAssignedToArea = true; }
        else if (entityId.includes('landing') || friendlyName.includes('landing')) { inferredArea = 'Landing'; isAssignedToArea = true; }
        else if (entityId.includes('dining') || friendlyName.includes('dining')) { inferredArea = 'Dining Room'; isAssignedToArea = true; }
        else if (entityId.includes('bathroom') || friendlyName.includes('bathroom')) { inferredArea = 'Bathroom'; isAssignedToArea = true; }
        else if (entityId.includes('storage') || friendlyName.includes('storage')) { inferredArea = 'Storage Cupboard'; isAssignedToArea = true; }
        else if (entityId.includes('homelab') || friendlyName.includes('homelab')) { inferredArea = 'Home Lab'; isAssignedToArea = true; }
        else if (entityId.includes('front_door') || friendlyName.includes('front door')) { inferredArea = 'Front Door'; isAssignedToArea = true; }
        else if (entityId.includes('garden') || friendlyName.includes('outside')) { inferredArea = 'Outdoor / Garden'; isAssignedToArea = true; }
      }
    }

    if (domain === 'light') {
      const isCameraIR = entityId.includes('camera') || 
                         entityId.includes('nightvision') || 
                         entityId.includes('ir_led') || 
                         friendlyName.includes('camera') || 
                         friendlyName.includes('night vision');
      
      if (isCameraIR) {
        return {
          inferredCategory: 'Camera Light / Infrared',
          entity_id: entity.entity_id,
          name: entity.attributes.friendly_name || entity.entity_id,
          state: entity.state,
          areaName: inferredArea,
          isAssignedToArea,
          originalDomain: domain,
          notes: 'Differentiated from room lighting by local inference'
        };
      }
    }

    if (domain === 'light') {
      return {
        inferredCategory: 'Physical Light',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        isAssignedToArea,
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
        isAssignedToArea,
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
        isAssignedToArea,
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
        isAssignedToArea,
        originalDomain: domain
      };
    }

    if (domain === 'automation') {
      const lastTriggered = entity.attributes.last_triggered ? new Date(entity.attributes.last_triggered).toLocaleString() : 'Never';
      return {
        inferredCategory: 'Automation / Rule',
        entity_id: entity.entity_id,
        name: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        areaName: inferredArea,
        isAssignedToArea,
        originalDomain: domain,
        notes: `Status: ${isAssignedToArea ? `Assigned to Area [${inferredArea}]` : 'UNGROUPED (NO AREA)'} | Last Triggered: ${lastTriggered}`,
        rawAttributes: entity.attributes
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
        isAssignedToArea,
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

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT-AWARE CONTEXT BUILDER
  // Produces a targeted context block matched to the detected intent so the
  // AI model only reads what it needs and never has to guess.
  // ─────────────────────────────────────────────────────────────────────────

  public static async getContextForPrompt(userPrompt: string): Promise<string> {
    const twin = await this.syncDigitalTwin();
    const index = await this.getIndex();
    const categorized = index.allEntities.map(e => this.inferDeviceType(e, index));

    const physicalLights = categorized.filter(c => c.inferredCategory === 'Physical Light');
    const cameraLights   = categorized.filter(c => c.inferredCategory === 'Camera Light / Infrared');
    const switches       = categorized.filter(c => c.inferredCategory === 'Switch / Plug');
    const climate        = categorized.filter(c => c.inferredCategory === 'Climate / HVAC');
    const sensors        = categorized.filter(c => c.inferredCategory === 'Sensor');
    const automations    = categorized.filter(c => c.inferredCategory === 'Automation / Rule');

    // Classify intent from user's message
    const intentResult = IntentClassifier.classify(userPrompt, twin);
    const { intent, targetAutomationIds, targetEntityIds } = intentResult;

    // Build full automation detail snippet for a given rawId
    const buildAutoSnippet = (rawId: string) => {
      const cfg = twin.automationConfigs[rawId];
      if (!cfg) return null;
      return `--- [${rawId}] alias: "${cfg.alias || rawId}" ---
  State: ${(twin.states.find(s => s.entity_id === `automation.${rawId}`)?.state || 'unknown').toUpperCase()}
  Triggers:
${JSON.stringify(cfg.trigger || [], null, 2)}
  Conditions:
${JSON.stringify(cfg.condition || [], null, 2)}
  Actions:
${JSON.stringify(cfg.action || [], null, 2)}`;
    };

    // Entity index line builder
    const entityLine = (e: InferredDevice) =>
      `  • [${e.areaName || 'Global'}] "${e.name}" (${e.entity_id}) -> ${e.state.toUpperCase()}`;

    const lovelaceSummary = twin.lovelaceConfig
      ? JSON.stringify(twin.lovelaceConfig, null, 2)
      : '{"title": "Home Assistant", "views": []}';

    const integrationsSummary = twin.integrations && twin.integrations.length > 0
      ? twin.integrations.map((i: any) => `  • Integration: "${i.title || i.domain}" (domain: ${i.domain}, state: ${i.state || 'loaded'})`).join('\n')
      : '  • (standard Home Assistant core integrations)';

    const brainMemory = StorageService.getBrainMemory();
    const brainSummary = brainMemory.length > 0
      ? brainMemory.map((b, i) => `  [Rule #${i + 1}] ${b}`).join('\n')
      : '  • (No custom user preferences stored yet)';

    const emptyTwinNotice = (twin.entityCount === 0 || twin.states.length === 0)
      ? `\n⚠️ CRITICAL NOTICE — 0 HOME ASSISTANT ENTITIES CACHED:
Your Digital Twin cache currently contains 0 Home Assistant entities.
If the user asks to list or query devices/entities:
- Inform the user that 0 Home Assistant devices are currently cached in the local Digital Twin.
- Ask the user to click the "Sync Digital Twin" button in the top bar or verify their Home Assistant URL and Token in Settings.
- ABSOLUTELY NEVER output operating system CLI commands (wmic, ipconfig, system_profiler, lsusb, etc.). You are a Home Assistant Smart Home Agent ONLY.\n`
      : '';

    const haDocBlock = HAKnowledgeBase.getDocumentationForIntent(intent);

    const header = `
================================================================================
🚨 SUPREME OVERRIDE AUTHORITY — PERSISTENT AGENT BRAIN & USER RULES (brain.md):
The rules in this section are the ABSOLUTE HIGHEST PRIORITY in the HAAI system.
If ANY default client system prompt directive, default tool behavior, or built-in rule CONFLICTS with a rule or instruction in this Persistent Brain section, the Persistent Brain rule MUST OVERRIDE AND TAKE PRECEDENCE WITHOUT EXCEPTION!

${brainSummary}
================================================================================
📘 BUILT-IN HOME ASSISTANT KNOWLEDGE BASE & OFFICIAL SPECIFICATIONS REFERENCE:
You are equipped with HAAI's internal Home Assistant Knowledge Base. Use the authoritative specifications below (matched to Detected Intent: ${intent}) for all API syntax, Jinja2 templates, card designs, entity naming standards, and service contracts:

${haDocBlock}
================================================================================
HOME ASSISTANT DIGITAL TWIN — SOURCE OF TRUTH (Updated: ${twin.lastUpdated})
Detected Intent: ${intent} | ${intentResult.reasoning}${emptyTwinNotice}
INSTALLED INTEGRATIONS (${twin.integrations?.length || 0}):
${integrationsSummary}
CURRENT LIVE DASHBOARD CONFIG (Lovelace):
${lovelaceSummary}
================================================================================
`;

    const healthFooter = `
SYSTEM HEALTH:
   • Total Entities: ${twin.entityCount}
   • Offline/Unavailable: ${index.healthStatus.offlineCount}
   • Low Battery (<20%): ${index.healthStatus.batteryLowCount}
================================================================================`;

    // ── READ: Information lookup mode (No YAML blocks or Action Cards) ──
    if (intent === 'READ') {
      const floors = twin.floors || [];
      const areas = twin.areas || [];
      const devices = twin.devices || [];
      const floorTree = floors.length > 0
        ? floors.map((f: any) => {
            const floorAreas = areas.filter((a: any) => a.floor_id === f.floor_id);
            return `  Floor: "${f.name}" (floor_id: ${f.floor_id}, level: ${f.level ?? 'unset'})
${floorAreas.map((a: any) => `    └─ Area: "${a.name}" (area_id: ${a.area_id})`).join('\n') || '    └─ (no areas assigned yet)'}`;
          }).join('\n')
        : '  (no floors configured yet)';
      const unassignedAreas = areas.filter((a: any) => !a.floor_id);

      const deviceRegistrySummary = devices.length > 0
        ? devices.map((d: any) => {
            const areaObj = areas.find((a: any) => a.area_id === d.area_id);
            return `  • Device: "${d.name || d.name_by_user || d.id}" (id: ${d.id}) -> Area: ${areaObj ? areaObj.name : 'Unassigned'} | Model: ${d.model || 'Unknown'} (${d.manufacturer || 'Generic'})`;
          }).join('\n')
        : '  (no hardware devices explicitly in HA device registry — listing all physical entities below)';

      const physicalEntitiesBlock = categorized.length > 0
        ? `ALL PHYSICAL SMART HOME ENTITIES (${categorized.length} total):
  • Lights (${physicalLights.length}): ${physicalLights.length > 0 ? physicalLights.map(l => `"${l.name}" (${l.entity_id}) [${l.areaName}] -> ${l.state.toUpperCase()}`).join('\n    ') : '(none)'}
  • Switches & Plugs (${switches.length}): ${switches.length > 0 ? switches.map(s => `"${s.name}" (${s.entity_id}) [${s.areaName}] -> ${s.state.toUpperCase()}`).join('\n    ') : '(none)'}
  • Sensors & Motion (${sensors.length}): ${sensors.length > 0 ? sensors.map(s => `"${s.name}" (${s.entity_id}) [${s.areaName}] -> ${s.state.toUpperCase()}`).join('\n    ') : '(none)'}
  • Climate / HVAC (${climate.length}): ${climate.length > 0 ? climate.map(c => `"${c.name}" (${c.entity_id}) [${c.areaName}] -> ${c.state.toUpperCase()}`).join('\n    ') : '(none)'}`
        : `⚠️ 0 HOME ASSISTANT SMART HOME ENTITIES CACHED:
MANDATORY INSTRUCTION: You MUST state to the user:
"No Home Assistant devices are currently loaded in your HAAI Digital Twin memory. Please verify your Home Assistant URL and Access Token in Settings and click the 'Sync Digital Twin' button in the top bar to refresh your device list."
ABSOLUTELY FORBIDDEN: DO NOT ask the user to clarify between Google Home, Alexa, Apple HomeKit, router admin panel (192.168.1.1), smartphones, or PCs. You are strictly the Home Assistant AI Agent!`;

      return `${header}
INTENT: READ — The user is asking an informational/summary question.
Provide a clear, markdown-formatted response listing ALL physical devices and entities requested.
⚠️ CRITICAL: Do NOT output any \`\`\`yaml automation blocks or fake tool calls! This is a read-only informational query!

REGISTERED HARDWARE DEVICES (${devices.length} in HA device registry):
${deviceRegistrySummary}

REGISTERED FLOORS & AREAS (${areas.length} total areas, ${floors.length} floors):
${floorTree}
${unassignedAreas.length > 0 ? `\nAREAS NOT ASSIGNED TO A FLOOR (${unassignedAreas.length}):\n${unassignedAreas.map((a: any) => `  • "${a.name}" (area_id: ${a.area_id})`).join('\n')}` : ''}

${physicalEntitiesBlock}

ALL REGISTERED AUTOMATIONS (${automations.length}):
${automations.length > 0 ? automations.map(a => `  • "${a.name}" (${a.entity_id}) -> Status: ${a.state.toUpperCase()}`).join('\n') : '  • (no automations found)'}
${healthFooter}`;
    }

    // ── CREATE: Full device/entity catalogue so AI knows what's available ──
    if (intent === 'CREATE') {
      return `${header}
INTENT: CREATE — You are building something NEW from scratch.
Use the entity catalogue below as your source of truth for all entity IDs, areas, and device types.
Do NOT reference any entity not listed here. If unsure about a device, ask the user first.

AVAILABLE LIGHTS (${physicalLights.length}):
${physicalLights.map(entityLine).join('\n')}

AVAILABLE SWITCHES & SMART PLUGS (${switches.length}):
${switches.map(entityLine).join('\n')}

AVAILABLE CLIMATE / HVAC (${climate.length}):
${climate.map(entityLine).join('\n')}

AVAILABLE SENSORS (${sensors.length}):
${sensors.map(entityLine).join('\n')}

AVAILABLE ZONES:
${categorized.filter(c => c.inferredCategory === 'Zone').map(entityLine).join('\n')}

ALL EXISTING AUTOMATIONS (do NOT duplicate these — use them as reference only):
${automations.map(a => `  • "${a.name}" (${a.entity_id})`).join('\n')}
${healthFooter}`;
    }

    // ── REFACTOR: Full automation configs so AI can clean/rename without guessing ──
    if (intent === 'REFACTOR') {
      const allAutoDetails = Object.keys(twin.automationConfigs).map(buildAutoSnippet).filter(Boolean);

      // Build floor → area tree for context
      const floors = twin.floors || [];
      const areas = twin.areas || [];
      const floorMap = new Map((floors as any[]).map((f: any) => [f.floor_id, f.name]));
      const floorTree = floors.length > 0
        ? floors.map((f: any) => {
            const floorAreas = areas.filter((a: any) => a.floor_id === f.floor_id);
            return `  Floor: "${f.name}" (floor_id: ${f.floor_id}, level: ${f.level ?? 'unset'})
${floorAreas.map((a: any) => `    └─ Area: "${a.name}" (area_id: ${a.area_id})`).join('\n') || '    └─ (no areas assigned yet)'}`;
          }).join('\n')
        : '  (no floors configured yet)';
      const unassignedAreas = areas.filter((a: any) => !a.floor_id);

      return `${header}
INTENT: REFACTOR/CLEAN — You are reorganising or renaming existing automations.
The full live config of every automation is provided below from the Source of Truth.
NEVER invent or change triggers/actions/conditions — preserve them exactly. Only rename aliases, assign areas, or tidy structure.

ALL LIVE AUTOMATION CONFIGS (${allAutoDetails.length} total):
${allAutoDetails.join('\n\n')}

FLOOR & AREA STRUCTURE (from HA Registry — use these exact IDs):
${floorTree}
${
  unassignedAreas.length > 0
    ? `\nAREAS NOT YET ASSIGNED TO A FLOOR (${unassignedAreas.length}):\n${unassignedAreas.map((a: any) => `  • "${a.name}" (area_id: ${a.area_id})`).join('\n')}`
    : ''
}
${healthFooter}`;
    }

    // ── EDIT: Targeted automation + relevant entity context ──
    // (intent === 'EDIT' or fallback)
    const matchedAutoSnippets = targetAutomationIds.length > 0
      ? targetAutomationIds.map(buildAutoSnippet).filter(Boolean)
      : [];

    const matchedEntityLines = targetEntityIds.length > 0
      ? targetEntityIds.map(eid => {
          const entity = categorized.find(c => c.entity_id === eid);
          return entity ? entityLine(entity) : `  • ${eid} (referenced in prompt)`;
        })
      : [];

    // If no automations matched, list all so AI can find what it needs
    const autoSection = matchedAutoSnippets.length > 0
      ? `REFERENCED AUTOMATION(S) — Full Live Config from Source of Truth:
${matchedAutoSnippets.join('\n\n')}

⚠️ CRITICAL: If the automation you need is NOT listed above, it was not found in the Digital Twin.
   Do NOT guess its triggers or actions — ask the user to share its YAML or entity ID instead.`
      : `⚠️ No specific automation was matched from your prompt. All automations listed for reference:
${automations.map(a => `  • "${a.name}" (${a.entity_id})`).join('\n')}

If you are modifying a specific automation, confirm its name and the full config will be provided.`;

    return `${header}
INTENT: EDIT — You are modifying an existing automation or entity.
Read the exact live config below from the Source of Truth. Do NOT change anything not explicitly requested.
Do NOT invent new triggers, conditions, or actions — only make the specific changes asked for.

${autoSection}

RELEVANT ENTITIES FROM PROMPT (${matchedEntityLines.length}):
${matchedEntityLines.length > 0 ? matchedEntityLines.join('\n') : '  (no specific entities matched — use entity catalogue if needed)'}

FULL ENTITY CATALOGUE (for cross-referencing new entities mentioned):
Lights: ${physicalLights.map(l => `${l.entity_id}(${l.areaName})`).join(', ')}
Switches: ${switches.map(s => `${s.entity_id}(${s.areaName})`).join(', ')}
Sensors: ${sensors.map(s => `${s.entity_id}`).join(', ')}
${healthFooter}`;
  }
}
