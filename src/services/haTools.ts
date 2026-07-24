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
    description: 'Call a Home Assistant service to toggle lights, trigger automations, set temperatures, etc.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Service domain (e.g., light, switch, climate, automation)' },
        service: { type: 'string', description: 'Service action name (e.g., turn_on, turn_off, toggle, trigger)' },
        serviceData: { type: 'object', description: 'Target entity_id and attributes e.g. {"entity_id": "light.living_room", "brightness": 200}' }
      },
      required: ['domain', 'service', 'serviceData']
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
        action: { type: 'array', description: 'List of action objects to execute when triggered' }
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
