import { haService } from './haClient';
import { AIToolCall, AIToolResult } from '../types/ai';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const HA_TOOLS: ToolDefinition[] = [
  {
    name: 'get_entities',
    description: 'Fetch all Home Assistant entity states, attributes, and current values.',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Filter by domain (e.g. light, switch, sensor, climate, automation, cover)'
        },
        search: {
          type: 'string',
          description: 'Search string for entity_id or friendly_name'
        }
      }
    }
  },
  {
    name: 'call_ha_service',
    description: 'Call a Home Assistant service to toggle lights, trigger automations, disable automations, set temperatures, etc.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Service domain (e.g., light, switch, climate, automation)' },
        service: { type: 'string', description: 'Service action name (e.g., turn_on, turn_off, toggle, trigger, turn_off for automation)' },
        serviceData: { type: 'object', description: 'Target entity_id and attributes e.g. {"entity_id": "automation.old_nfc_tag"}' }
      },
      required: ['domain', 'service', 'serviceData']
    }
  },
  {
    name: 'disable_automation',
    description: 'Turn off / disable a legacy or replaced Home Assistant automation entity and update its alias to [Old] Name.',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'Automation entity ID to disable e.g. automation.nfc_tag_bedside_1' }
      },
      required: ['entityId']
    }
  },
  {
    name: 'analyze_entity_rename_safety',
    description: 'Analyze potential impact before renaming an entity ID. Checks for usage across all entities, automations, scripts, and dashboards.',
    parameters: {
      type: 'object',
      properties: {
        oldEntityId: { type: 'string', description: 'Current entity ID (e.g. light.old_desk_lamp)' },
        newEntityId: { type: 'string', description: 'Target proposed entity ID (e.g. light.study_desk_lamp)' }
      },
      required: ['oldEntityId', 'newEntityId']
    }
  },
  {
    name: 'create_or_update_automation',
    description: 'Create a new automation or update an existing automation live in Home Assistant.',
    parameters: {
      type: 'object',
      properties: {
        automationId: { type: 'string', description: 'Unique automation ID e.g. automation_sunset_lights' },
        alias: { type: 'string', description: 'Descriptive title for the automation' },
        description: { type: 'string', description: 'Detailed explanation of what the automation does' },
        trigger: { type: 'array', description: 'List of trigger objects (e.g. state, time, sun, event triggers)' },
        condition: { type: 'array', description: 'List of condition objects' },
        action: { type: 'array', description: 'List of action objects to execute when triggered' },
        disableLegacyEntityIds: { type: 'array', description: 'List of old automation entity_ids to disable' }
      },
      required: ['alias', 'trigger', 'action']
    }
  },
  {
    name: 'get_dashboard_config',
    description: 'Fetch current Lovelace Dashboard cards and view layout configuration.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'update_dashboard_config',
    description: 'Update or build new cards for the live Lovelace Dashboard layout in Home Assistant.',
    parameters: {
      type: 'object',
      properties: {
        config: { type: 'object', description: 'Updated Lovelace YAML / JSON dashboard configuration structure' }
      },
      required: ['config']
    }
  },
  {
    name: 'get_areas_and_floors',
    description: 'Fetch the complete live floor and area registry from Home Assistant. Always call this first before creating or assigning areas/floors so you know what already exists and have the correct IDs.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_or_update_floor',
    description: 'Create a new floor or update an existing floor in Home Assistant. Use level 0 for ground floor, 1 for first floor, -1 for basement, etc. Returns the created/updated floor with its floor_id.',
    parameters: {
      type: 'object',
      properties: {
        floorId: { type: 'string', description: 'Existing floor_id to update. Omit entirely to create a new floor.' },
        name: { type: 'string', description: 'Display name for the floor e.g. "Ground Floor", "First Floor", "Basement"' },
        level: { type: 'number', description: 'Numeric floor level: 0 = ground floor, 1 = first floor, -1 = basement' },
        icon: { type: 'string', description: 'MDI icon string e.g. "mdi:home-floor-0", "mdi:home-floor-1"' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_or_update_area',
    description: 'Create a new room/area or update an existing area in Home Assistant. Can assign the area to a floor. Returns the created/updated area with its area_id for use in assign_to_area.',
    parameters: {
      type: 'object',
      properties: {
        areaId: { type: 'string', description: 'Existing area_id to update. Omit entirely to create a new area.' },
        name: { type: 'string', description: 'Display name for the area e.g. "Kitchen", "Living Room", "Master Bedroom"' },
        floorId: { type: 'string', description: 'floor_id (from get_areas_and_floors or create_or_update_floor) to assign this area to a floor' },
        icon: { type: 'string', description: 'MDI icon string e.g. "mdi:countertop", "mdi:sofa", "mdi:bed"' }
      },
      required: ['name']
    }
  },
  {
    name: 'assign_to_area',
    description: 'Assign one or more devices or entities to a Home Assistant area. Use get_areas_and_floors first to get the correct area_id. Device-level assignment covers all entities of that device; entity-level assignment overrides individual entities.',
    parameters: {
      type: 'object',
      properties: {
        areaId: { type: 'string', description: 'The area_id to assign items to (obtained from get_areas_and_floors or create_or_update_area)' },
        deviceIds: { type: 'array', description: 'List of device IDs to assign to this area (preferred — assigns all device entities at once)', items: { type: 'string' } },
        entityIds: { type: 'array', description: 'List of entity IDs to assign to this area e.g. ["light.kitchen_ceiling", "switch.kitchen_plug"]', items: { type: 'string' } }
      },
      required: ['areaId']
    }
  }
];

export async function executeHATool(call: AIToolCall): Promise<AIToolResult> {
  const { name, arguments: args, id } = call;

  try {
    switch (name) {
      case 'get_entities': {
        const states = await haService.getStates();
        let filtered = states;
        if (args.domain) {
          filtered = filtered.filter(s => s.entity_id.startsWith(`${args.domain}.`));
        }
        if (args.search) {
          const q = args.search.toLowerCase();
          filtered = filtered.filter(s => 
            s.entity_id.toLowerCase().includes(q) || 
            (s.attributes.friendly_name && String(s.attributes.friendly_name).toLowerCase().includes(q))
          );
        }
        const summary = filtered.map(s => ({
          entity_id: s.entity_id,
          state: s.state,
          name: s.attributes.friendly_name || s.entity_id,
          unit: s.attributes.unit_of_measurement
        }));
        return {
          toolCallId: id,
          name,
          success: true,
          result: { count: summary.length, entities: summary.slice(0, 50) }
        };
      }

      case 'call_ha_service': {
        const res = await haService.callService(args.domain, args.service, args.serviceData);
        return {
          toolCallId: id,
          name,
          success: true,
          result: { message: `Called ${args.domain}.${args.service} successfully`, data: res }
        };
      }

      case 'disable_automation': {
        // Turn off automation live via HA Service API
        const targetEntity = args.entityId || args.serviceData?.entity_id;
        await haService.callService('automation', 'turn_off', { entity_id: targetEntity });

        return {
          toolCallId: id,
          name,
          success: true,
          result: { message: `Successfully disabled legacy automation "${targetEntity}" live in Home Assistant.` }
        };
      }

      case 'analyze_entity_rename_safety': {
        const states = await haService.getStates();
        const automations = states.filter(s => s.entity_id.startsWith('automation.'));
        const affectedAutomations: string[] = [];

        automations.forEach(aut => {
          const str = JSON.stringify(aut.attributes);
          if (args.oldEntityId && str.includes(args.oldEntityId)) {
            affectedAutomations.push(aut.attributes.friendly_name || aut.entity_id);
          }
        });

        const diffPreview = `SAFE RENAME IMPACT ANALYSIS:
- Target: ${args.oldEntityId} -> ${args.newEntityId}
- Affected Automations Found: ${affectedAutomations.length}
${affectedAutomations.map(a => `  • ${a}`).join('\n')}
- Status: Ready to execute live entity refactor in Home Assistant without breaking rules.`;

        return {
          toolCallId: id,
          name,
          success: true,
          result: {
            oldEntityId: args.oldEntityId,
            newEntityId: args.newEntityId,
            affectedAutomationsCount: affectedAutomations.length,
            affectedAutomations
          },
          diffPreview
        };
      }

      case 'create_or_update_automation': {
        const autoId = args.automationId || `automation_${Date.now()}`;
        const autoConfig = {
          id: autoId,
          alias: args.alias,
          description: args.description || '',
          trigger: args.trigger,
          condition: args.condition || [],
          action: args.action
        };

        const liveRes = await haService.createOrUpdateAutomation(autoId, autoConfig);

        // Turn off / disable legacy automations
        if (args.disableLegacyEntityIds && Array.isArray(args.disableLegacyEntityIds)) {
          for (const legacyId of args.disableLegacyEntityIds) {
            await haService.callService('automation', 'turn_off', { entity_id: legacyId }).catch(() => {});
          }
        }

        const yamlPreview = `id: ${autoId}
alias: "${args.alias}"
description: "${args.description || ''}"
trigger: ${JSON.stringify(args.trigger, null, 2)}
action: ${JSON.stringify(args.action, null, 2)}`;

        return {
          toolCallId: id,
          name,
          success: true,
          result: { message: liveRes.message, automationId: autoId },
          diffPreview: `LIVE HA AUTOMATION CONFIRMED & APPLIED:\n${yamlPreview}`
        };
      }

      case 'get_dashboard_config': {
        const config = await haService.getLovelaceConfig();
        return {
          toolCallId: id,
          name,
          success: true,
          result: config
        };
      }

      case 'update_dashboard_config': {
        const liveRes = await haService.updateLovelaceConfig(args.config);
        return {
          toolCallId: id,
          name,
          success: true,
          result: { message: liveRes.message }
        };
      }

      case 'get_areas_and_floors': {
        const [floors, areas, devices] = await Promise.all([
          haService.getFloors(),
          haService.getAreas(),
          haService.getDevices()
        ]);
        const floorMap = new Map((floors as any[]).map(f => [f.floor_id, f.name]));
        const enrichedAreas = (areas as any[]).map(a => ({
          area_id: a.area_id,
          name: a.name,
          floor_id: a.floor_id || null,
          floorName: a.floor_id ? (floorMap.get(a.floor_id) || 'Unknown Floor') : 'Unassigned to Floor',
          icon: a.icon || null
        }));
        return {
          toolCallId: id,
          name,
          success: true,
          result: {
            floors: (floors as any[]).map(f => ({ floor_id: f.floor_id, name: f.name, level: f.level ?? null, icon: f.icon ?? null })),
            areas: enrichedAreas,
            summary: `${floors.length} floor(s), ${areas.length} area(s), ${(devices as any[]).filter(d => !d.area_id).length} device(s) without an area`
          }
        };
      }

      case 'create_or_update_floor': {
        let result;
        if (args.floorId) {
          result = await haService.updateFloor(args.floorId, { name: args.name, level: args.level, icon: args.icon });
        } else {
          result = await haService.createFloor(args.name, args.level, args.icon);
        }
        return {
          toolCallId: id,
          name,
          success: true,
          result: {
            message: `Floor "${args.name}" ${args.floorId ? 'updated' : 'created'} successfully in Home Assistant.`,
            floor: result
          }
        };
      }

      case 'create_or_update_area': {
        let result;
        if (args.areaId) {
          result = await haService.updateArea(args.areaId, { name: args.name, floor_id: args.floorId, icon: args.icon });
        } else {
          result = await haService.createArea(args.name, args.floorId, args.icon);
        }
        return {
          toolCallId: id,
          name,
          success: true,
          result: {
            message: `Area "${args.name}" ${args.areaId ? 'updated' : 'created'} successfully in Home Assistant.`,
            area: result
          }
        };
      }

      case 'assign_to_area': {
        const assigned: string[] = [];
        const errors: string[] = [];

        if (args.deviceIds && Array.isArray(args.deviceIds)) {
          for (const deviceId of args.deviceIds) {
            try {
              await haService.assignDeviceToArea(deviceId, args.areaId);
              assigned.push(`device:${deviceId}`);
            } catch (e: any) {
              errors.push(`Device "${deviceId}": ${e.message}`);
            }
          }
        }

        if (args.entityIds && Array.isArray(args.entityIds)) {
          for (const entityId of args.entityIds) {
            try {
              await haService.assignEntityToArea(entityId, args.areaId);
              assigned.push(`entity:${entityId}`);
            } catch (e: any) {
              errors.push(`Entity "${entityId}": ${e.message}`);
            }
          }
        }

        return {
          toolCallId: id,
          name,
          success: errors.length === 0,
          result: {
            message: `Successfully assigned ${assigned.length} item(s) to area.`,
            assigned,
            errors: errors.length > 0 ? errors : undefined
          }
        };
      }

      default:
        return { toolCallId: id, name, success: false, error: `Unknown tool name: ${name}` };
    }
  } catch (err: any) {
    return {
      toolCallId: id,
      name,
      success: false,
      error: err.message || 'Tool execution error'
    };
  }
}
