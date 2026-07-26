/**
 * Home Assistant Knowledge Base & Specification Engine
 *
 * Provides comprehensive reference specs, API contracts, Jinja2 templating patterns,
 * automation schemas, Lovelace card structures, and architectural best practices
 * for all AI models connected to HAAI.
 */

export const HA_NAMING_AND_ORGANIZATION_RULES = `
================================================================================
SECTION A — HOME ASSISTANT ENTITY NAMING & ORGANIZATION STANDARDS
================================================================================
1. ENTITY ID SCRIPTING & FORMATTING PATTERN:
   • Pattern: [domain].[location]_[device_type]_[function]
   • Examples:
       - light.living_room_ceiling
       - sensor.kitchen_fridge_temperature
       - switch.bedroom_bedside_plug
       - binary_sensor.front_door_motion
       - climate.master_bedroom_thermostat
   • Entity IDs MUST be permanent, lowercase, and snake_case using only [a-z0-9_].

2. FRIENDLY NAME STANDARDS:
   • Keep friendly names clean, human-readable, and free of redundant domain words.
   • GOOD: "Living Room Ceiling" (entity_id: light.living_room_ceiling)
   • BAD:  "Living Room Ceiling Light Light" (redundant domain words)

3. 4-LEVEL ARCHITECTURAL HIERARCHY:
   • Level 1 — Physical Entity (e.g. light.living_room_ceiling, switch.fan)
   • Level 2 — Parent Hardware Device (e.g. Device: "Philips Hue Ceiling Light 1")
   • Level 3 — Area / Room (e.g. Area: "Living Room", area_id: "living_room")
   • Level 4 — Floor / Level (e.g. Floor: "Ground Floor", level: 0)
   • Always group entities under their Parent Device, assign Devices to Areas, and assign Areas to Floors.
`;

export const HA_DASHBOARD_UX_RULES = `
================================================================================
SECTION B — DASHBOARD UX DESIGN & LAYOUT BEST PRACTICES
================================================================================
1. THE 3-SECOND GLANCEABILITY RULE:
   • The top row/section of a view MUST be reserved for critical summary indicators:
       - Security & Alarm status (alarm_control_panel)
       - Unlocked doors / Open garage doors (lock, cover)
       - Active climate / HVAC mode (climate)
       - Low battery alert count (<20%)
   • Use Chips or Badges at the top for quick glanceable status.

2. MOBILE-FIRST RESPONSIVE SECTION STRATEGY:
   • Use Section/Grid layouts (type: sections or type: grid).
   • Single-column stacked layout on mobile; 2-3 column section view on tablet/desktop.

3. MUSHROOM CARDS & VISUAL CONSISTENCY (HACS):
   • Entity Card: custom:mushroom-entity-card (icon, name, state)
   • Light Card:  custom:mushroom-light-card (show_brightness_control: true, use_light_color: true)
   • Climate Card: custom:mushroom-climate-card (show_temperature_control: true)
   • Cover Card: custom:mushroom-cover-card (show_position_control: true)
   • Chips Card: custom:mushroom-chips-card (type: entity / template / action)
   • Template Card: custom:mushroom-template-card (primary, secondary, icon, icon_color with Jinja2)

4. CONDITIONAL VISIBILITY & POPUPS:
   • Hide inactive/irrelevant controls using type: conditional (e.g. show AC booster controls only when climate state is 'cool' or temperature > 24°C).
   • Use subview: true for detailed room sub-pages to keep main dashboards clean.
`;

export const HA_JINJA2_SPECS = `
================================================================================
SECTION C — JINJA2 TEMPLATING ENGINE & HOME ASSISTANT EXTENSIONS
================================================================================
1. STATE ACCESSOR FUNCTIONS (SAFE FOR NULL STATES):
   • states('light.living_room')                   → Returns state string e.g. 'on', 'off'
   • is_state('light.living_room', 'on')            → Returns boolean (true/false)
   • state_attr('climate.bedroom', 'temperature')   → Returns attribute value or null
   • is_state_attr('climate.bedroom', 'hvac_action', 'heating') → Returns boolean

2. REGISTRY & SPATIAL LOOKUPS:
   • device_id('light.living_room')                → Returns HA device_id string
   • area_id('light.living_room')                  → Returns area_id string e.g. 'living_room'
   • area_name('light.living_room')                → Returns area display name e.g. 'Living Room'
   • area_entities('living_room')                  → Returns list of entity_ids in area
   • area_devices('living_room')                   → Returns list of device_ids in area

3. MATH, DATE, & FILTER DEFAULT EXTENSIONS:
   • iif(is_state('light.hall', 'on'), 'Active', 'Off')
   • states('sensor.temp') | float(default=20.0)   → MUST ALWAYS provide default parameter!
   • states('sensor.count') | int(default=0)       → MUST ALWAYS provide default parameter!
   • states('input_boolean.test') | bool(default=false)
   • today_at("08:00")                             → Datetime object for today 8 AM
   • as_timestamp(now())                          → UNIX timestamp float
   • relative_time(states.sensor.uptime.last_changed)
`;

export const HA_AUTOMATION_SCHEMAS = `
================================================================================
SECTION D — AUTOMATION & CONTROL FLOW SCHEMAS
================================================================================
1. AUTOMATION MODES:
   • mode: single     → Default. Drops new triggers if currently running.
   • mode: restart    → Cancels current execution and restarts from top. Recommended for motion light timers!
   • mode: queued     → Queues executions in order (max: 10).
   • mode: parallel   → Runs multiple executions concurrently (max: 10).

2. TRIGGER PLATFORMS (12 CORE PLATFORMS):
   • state:          entity_id, from?, to?, for? (e.g. for: { minutes: 5 })
   • numeric_state:  entity_id, above?, below?, value_template?
   • time:           at (e.g. "22:00:00")
   • time_pattern:   hours?, minutes?, seconds? (e.g. minutes: "/15")
   • sun:            event ("sunset" / "sunrise"), offset? (e.g. "-00:45:00")
   • zone:           entity_id (person/device_tracker), zone, event ("enter"/"leave")
   • event:          event_type (e.g. "call_service", "custom_event"), event_data?
   • mqtt:           topic, payload?
   • webhook:        webhook_id
   • device:         device_id, domain, type, subtype
   • template:       value_template: "{{ is_state('sun.sun', 'below_horizon') }}"
   • conversation:   command (voice/chat trigger)

3. ADVANCED ACTION CONTROL FLOW:
   • Choose (Branching):
       - action: choose
         target: ...
         sequence: [...]
         default: [...]
   • If-Then-Else:
       - if:
           - condition: state
             entity_id: sun.sun
             state: "below_horizon"
         then:
           - action: light.turn_on
             target: { entity_id: light.living_room }
         else:
           - action: light.turn_off
             target: { entity_id: light.living_room }
   • Repeat Loop:
       - action: repeat
         for_each: ["light.kitchen_1", "light.kitchen_2"]
         sequence:
           - action: light.turn_on
             target: { entity_id: "{{ repeat.item }}" }
   • Wait For Trigger:
       - action: wait_for_trigger
         wait_for_trigger:
           - platform: state
             entity_id: binary_sensor.front_door
             to: "off"
         timeout: { minutes: 2 }
         continue_on_timeout: true
`;

export const HA_REST_AND_WEBSOCKET_SPECS = `
================================================================================
SECTION E — HOME ASSISTANT REST & WEBSOCKET API PROTOCOLS
================================================================================
1. REST API ENDPOINTS:
   • GET  /api/                             → Server discovery & connection verification
   • GET  /api/config                      → Instance info, location_name, version
   • GET  /api/states                      → List all live entity state objects
   • GET  /api/states/<entity_id>          → Get specific entity state object
   • GET  /api/services                    → List all registered domain services
   • POST /api/services/<domain>/<service> → Call a service action with JSON payload
   • POST /api/template                    → Render Jinja2 template payload string
   • GET  /api/config/automation/config/<id> → Fetch raw automation YAML/JSON config
   • POST /api/config/automation/config/<id> → Create/update automation config
   • DELETE /api/config/automation/config/<id> → Delete automation config permanently
   • GET  /api/lovelace/config             → Fetch live Lovelace dashboard layout
   • POST /api/lovelace/config             → Update live Lovelace dashboard layout

2. WEBSOCKET PROTOCOL COMMANDS (/api/websocket):
   • Handshake: Auth required → { type: "auth", access_token: "..." } → auth_ok
   • Registry Commands:
       - config/area_registry/list|create|update|delete
       - config/floor_registry/list|create|update|delete
       - config/device_registry/list|update
       - config/entity_registry/list|update
       - config/automation/delete { automation_id: "..." }
       - lovelace/dashboards/create { title, icon, url_path, mode: "storage" }
       - lovelace/config/save { config }
`;

export class HAKnowledgeBase {
  public static getFullDocumentation(): string {
    return `${HA_NAMING_AND_ORGANIZATION_RULES}
${HA_DASHBOARD_UX_RULES}
${HA_JINJA2_SPECS}
${HA_AUTOMATION_SCHEMAS}
${HA_REST_AND_WEBSOCKET_SPECS}`;
  }

  public static getDocumentationForIntent(intent: 'READ' | 'CREATE' | 'REFACTOR' | 'EDIT'): string {
    switch (intent) {
      case 'CREATE':
        return `${HA_AUTOMATION_SCHEMAS}\n${HA_JINJA2_SPECS}\n${HA_NAMING_AND_ORGANIZATION_RULES}`;
      case 'REFACTOR':
        return `${HA_NAMING_AND_ORGANIZATION_RULES}\n${HA_AUTOMATION_SCHEMAS}`;
      case 'EDIT':
        return `${HA_AUTOMATION_SCHEMAS}\n${HA_DASHBOARD_UX_RULES}`;
      case 'READ':
      default:
        return `${HA_NAMING_AND_ORGANIZATION_RULES}\n${HA_DASHBOARD_UX_RULES}`;
    }
  }
}
