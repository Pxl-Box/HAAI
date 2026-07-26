export interface SubCommand {
  name: string;
  description: string;
  injectedPrompt?: string;
}

export interface SlashCommand {
  id: string;
  name: string; // e.g. "automations", "dashboard", etc. (without or with leading slash normalized)
  description: string;
  subCommands?: SubCommand[];
  injectedPrompt: string;
  isCustom?: boolean;
}

export const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'automations',
    name: 'automations',
    description: 'Manage, debug, or write triggers, conditions, and actions.',
    injectedPrompt: 'The user wants to work with Home Assistant automations. Focus on triggers, conditions, actions, YAML structure, and automation logic best practices.',
    subCommands: [
      {
        name: 'unused',
        description: 'Audit and identify unused or disabled automations.',
        injectedPrompt: 'Audit Home Assistant automations to find unused, disabled, or redundant triggers and actions that can be cleaned up.'
      },
      {
        name: 'blueprints',
        description: 'Create or adapt automation blueprints.',
        injectedPrompt: 'Help create, debug, or adapt reusable Home Assistant automation blueprints with customizable inputs.'
      },
      {
        name: 'debug',
        description: 'Troubleshoot failing triggers or actions in automations.',
        injectedPrompt: 'Analyze trace logs, condition failures, and trigger events to troubleshoot why an automation failed or did not fire.'
      },
      {
        name: 'optimize',
        description: 'Refactor and simplify complex automation logic.',
        injectedPrompt: 'Optimize and streamline automation triggers, conditions, choose blocks, and scripts for maximum efficiency and readability.'
      }
    ]
  },
  {
    id: 'dashboard',
    name: 'dashboard',
    description: 'Design, edit, or troubleshoot Lovelace UI cards, views, and layouts.',
    injectedPrompt: 'The user is requesting Home Assistant Lovelace UI dashboard assistance. Provide clean card configurations, layout recommendations, CSS styling, or grid advice.',
    subCommands: [
      {
        name: 'views',
        description: 'Manage dashboard sub-views, routes, and main navigation pages.',
        injectedPrompt: 'Focus on Lovelace view definitions, routes, icons, subview navigation, and view layout strategies.'
      },
      {
        name: 'cards',
        description: 'Build or configure Lovelace UI cards (mushroom, apexcharts, tile, entities, etc.).',
        injectedPrompt: 'Generate or fix exact Lovelace card YAML (mushroom cards, button-card, tile cards, custom cards, picture-elements).'
      },
      {
        name: 'themes',
        description: 'Customize UI themes, dark mode variables, and visual aesthetics.',
        injectedPrompt: 'Help apply, create, or tweak Home Assistant themes, primary/secondary colors, background variables, and card backgrounds.'
      },
      {
        name: 'mobile',
        description: 'Optimize dashboard responsive layouts for mobile phones and tablets.',
        injectedPrompt: 'Design compact, touch-friendly mobile layouts for Home Assistant companion apps and tablets.'
      }
    ]
  },
  {
    id: 'areas',
    name: 'areas',
    description: 'Organize, map, or query devices, entities, and physical spaces.',
    injectedPrompt: 'The user is querying or organizing Home Assistant Areas, Floors, and physical space relationships.',
    subCommands: [
      {
        name: 'rooms',
        description: 'Group devices and sensors by specific room areas.',
        injectedPrompt: 'Manage room assignments, area entities, and room-specific controls.'
      },
      {
        name: 'floors',
        description: 'Map physical house floors and multi-room floor levels.',
        injectedPrompt: 'Structure Home Assistant Floor configurations, floor-level groupings, and multi-level area hierarchies.'
      },
      {
        name: 'devices',
        description: 'Inspect devices linked to specific areas.',
        injectedPrompt: 'List and inspect device-to-area mappings and resolve missing or orphaned area bindings.'
      },
      {
        name: 'mapping',
        description: 'Audit unassigned entities and map them to physical locations.',
        injectedPrompt: 'Audit entity registries to find unassigned entities and map them accurately to their physical areas.'
      }
    ]
  },
  {
    id: 'lighting',
    name: 'lighting',
    description: 'Control, group, and automate smart bulbs, switches, and LED strips.',
    injectedPrompt: 'The user wants to control or automate Home Assistant lighting systems (light entities, switches, groups, effects).',
    subCommands: [
      {
        name: 'dimming',
        description: 'Configure brightness levels, adaptive lighting, and dimming curves.',
        injectedPrompt: 'Focus on light dimming controls, brightness percentages, adaptive lighting, and smooth brightness transitions.'
      },
      {
        name: 'color',
        description: 'Adjust RGB colors, color temperatures, and color modes.',
        injectedPrompt: 'Manage color temp (kelvin/mireds), RGB/HSB color values, and light color capabilities.'
      },
      {
        name: 'scenes',
        description: 'Create, store, or trigger lighting scenes.',
        injectedPrompt: 'Create or activate Home Assistant light scenes (`scene.create` or `scene.turn_on`) for specific moods.'
      },
      {
        name: 'transitions',
        description: 'Set up smooth turn-on/turn-off transition fade times.',
        injectedPrompt: 'Configure gradual light transitions, sunrise/sunset fade effects, and timed light ramp-ups.'
      }
    ]
  },
  {
    id: 'motion',
    name: 'motion',
    description: 'Configure and troubleshoot occupancy detectors, radars, and triggers.',
    injectedPrompt: 'The user is configuring or troubleshooting motion sensors, mmWave presence radars, and occupancy triggers.',
    subCommands: [
      {
        name: 'zones',
        description: 'Define motion detection zones and distance boundaries.',
        injectedPrompt: 'Configure mmWave presence detection zones, exclusion zones, and detection ranges.'
      },
      {
        name: 'timeouts',
        description: 'Adjust motion clearing delay timers and occupancy timeouts.',
        injectedPrompt: 'Tune motion sensor off-delay timeouts, occupancy linger timers, and no-motion duration checks.'
      },
      {
        name: 'radar',
        description: 'Tune mmWave presence radars (Everything Presence One, LD2410, Aquara FP2, etc.).',
        injectedPrompt: 'Adjust sensitivity, distance thresholds, move/still energy parameters for mmWave radar sensors.'
      },
      {
        name: 'triggers',
        description: 'Build fast motion-activated lighting or security triggers.',
        injectedPrompt: 'Create low-latency motion-triggered automations with state condition checks.'
      }
    ]
  },
  {
    id: 'names',
    name: 'names',
    description: 'Audit, clean up, and standardize entity IDs, friendly names, and unique identifiers.',
    injectedPrompt: 'The user wants to audit, rename, or standardize entity IDs, friendly names, unique IDs, and area prefixes in Home Assistant.',
    subCommands: [
      {
        name: 'entities',
        description: 'Standardize entity ID naming conventions (e.g., `light.living_room_ceiling`).',
        injectedPrompt: 'Audit entity ID naming standards, fixing generic names like `light.light_2` to structured identifiers.'
      },
      {
        name: 'devices',
        description: 'Rename physical device names and bulk update entity prefixes.',
        injectedPrompt: 'Bulk update device names and synchronize associated entity ID prefixes.'
      },
      {
        name: 'areas',
        description: 'Synchronize area names across entity IDs and UI labels.',
        injectedPrompt: 'Ensure entity IDs consistently reflect their assigned physical area names.'
      },
      {
        name: 'aliases',
        description: 'Manage voice assistant aliases and friendly name overrides.',
        injectedPrompt: 'Configure friendly names and voice assistant aliases for Google Assistant / Alexa / Assist.'
      }
    ]
  },
  {
    id: 'security',
    name: 'security',
    description: 'Audit access control, lock states, local API tokens, and permissions.',
    injectedPrompt: 'The user wants to inspect security, access control, smart locks, alarm control panels, or access tokens in Home Assistant.',
    subCommands: [
      {
        name: 'users',
        description: 'Audit user accounts, admin status, and access groups.',
        injectedPrompt: 'Review Home Assistant user profiles, administrator flags, and local user access levels.'
      },
      {
        name: 'tokens',
        description: 'Manage Long-Lived Access Tokens and API credentials.',
        injectedPrompt: 'Audit API security, Long-Lived Access Tokens, and external integration tokens.'
      },
      {
        name: 'locks',
        description: 'Monitor and automate smart locks, keypads, and door states.',
        injectedPrompt: 'Configure smart lock controls, pin codes, auto-lock automations, and lock state monitoring.'
      },
      {
        name: 'alarms',
        description: 'Configure Alarm Control Panel integration and security zones.',
        injectedPrompt: 'Setup `alarm_control_panel` entities, arm home/away modes, and intruder alarm triggers.'
      }
    ]
  },
  {
    id: 'templates',
    name: 'templates',
    description: 'Write, test, and evaluate Jinja2 logic, state attributes, and sensors.',
    injectedPrompt: 'The user needs help with Jinja2 templating for Home Assistant (template sensors, state expressions, filters, state attributes).',
    subCommands: [
      {
        name: 'states',
        description: 'Query entity states, attributes, and default fallback values in Jinja2.',
        injectedPrompt: 'Write robust Jinja2 state templates (`states("sensor.temp")`, `state_attr(...)`) with safe default values.'
      },
      {
        name: 'math',
        description: 'Perform mathematical calculations, averages, and conversions in Jinja2.',
        injectedPrompt: 'Build math expressions, unit conversions, float filters, and numerical aggregations in Jinja2.'
      },
      {
        name: 'availability',
        description: 'Write availability template logic for template entities.',
        injectedPrompt: 'Write `availability` templates to prevent unavailable state warnings and errors.'
      },
      {
        name: 'formatting',
        description: 'Format dates, timestamps, strings, and lists in Jinja2.',
        injectedPrompt: 'Format Jinja2 outputs using `as_timestamp`, `strftime`, `relative_time`, string replacement, and list filters.'
      }
    ]
  },
  {
    id: 'logs',
    name: 'logs',
    description: 'Analyze system error logs, core warnings, and integration exceptions.',
    injectedPrompt: 'The user is analyzing Home Assistant system logs, error tracebacks, warnings, or integration failures.',
    subCommands: [
      {
        name: 'core',
        description: 'Inspect Home Assistant Core system logs and Python tracebacks.',
        injectedPrompt: 'Analyze HA Core python error logs, uncaught exceptions, and tracebacks.'
      },
      {
        name: 'integrations',
        description: 'Troubleshoot integration disconnects, custom component errors, and API timeouts.',
        injectedPrompt: 'Diagnose specific integration failures, custom component errors, and connection timeouts.'
      },
      {
        name: 'warnings',
        description: 'Audit deprecation warnings and performance bottleneck alerts.',
        injectedPrompt: 'Audit log warnings regarding deprecated YAML options, slow state changes, or database bloat.'
      },
      {
        name: 'startup',
        description: 'Review boot sequence logs and startup timing delays.',
        injectedPrompt: 'Analyze Home Assistant startup logs, component setup delays, and boot dependencies.'
      }
    ]
  }
];
