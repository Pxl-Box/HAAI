import asyncio
import logging
import json
from aiohttp import web

# Configure logging
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s [%(levelname)s] %(message)s',
  datefmt='%H:%M:%S'
)
logger = logging.getLogger("HATestEnv")

# Fake In-Memory State Registry
STATES = {
  "light.living_room_light": {
    "entity_id": "light.living_room_light",
    "state": "off",
    "attributes": {
      "friendly_name": "Living Room Light",
      "supported_features": 63,
      "brightness": 255
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  },
  "switch.hallway_diffuser": {
    "entity_id": "switch.hallway_diffuser",
    "state": "off",
    "attributes": {
      "friendly_name": "Hallway Diffuser",
      "icon": "mdi:fan"
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  },
  "switch.power_indicator_on": {
    "entity_id": "switch.power_indicator_on",
    "state": "off",
    "attributes": {
      "friendly_name": "Power Indicator ON"
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  },
  "binary_sensor.front_door_motion": {
    "entity_id": "binary_sensor.front_door_motion",
    "state": "off",
    "attributes": {
      "friendly_name": "Front Door Motion Sensor",
      "device_class": "motion"
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  },
  "automation.test_diffuser_refresher": {
    "entity_id": "automation.test_diffuser_refresher",
    "state": "on",
    "attributes": {
      "friendly_name": "Test: Diffuser Presence Refresher",
      "last_triggered": "2026-07-24T10:00:00.000Z"
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  }
}

AUTOMATION_CONFIGS = {}
AREAS = [
  {"area_id": "living_room", "name": "Living Room"},
  {"area_id": "hallway", "name": "Hallway"},
  {"area_id": "front_door", "name": "Front Door"}
]
DEVICES = []
ENTITIES_REGISTRY = []

# Middleware to log every incoming HTTP request live in real-time
@web.middleware
async def log_requests_middleware(request, handler):
  logger.info(f"--> HTTP {request.method} {request.path}")
  response = await handler(request)
  logger.info(f"<-- HTTP {response.status} {request.path}")
  return response

# API Handlers
async def handle_api(request):
  return web.json_response({"message": "API running"})

async def handle_config(request):
  return web.json_response({"location_name": "Test HA Environment", "version": "2026.7.0.test"})

async def handle_states(request):
  return web.json_response(list(STATES.values()))

async def handle_state_get(request):
  entity_id = request.match_info.get('entity_id')
  if entity_id in STATES:
    return web.json_response(STATES[entity_id])
  return web.json_response({"message": "Entity not found"}, status=404)

async def handle_services(request):
  return web.json_response([
    {"domain": "light", "services": {"turn_on": {}, "turn_off": {}, "toggle": {}}},
    {"domain": "switch", "services": {"turn_on": {}, "turn_off": {}, "toggle": {}}},
    {"domain": "automation", "services": {"turn_on": {}, "turn_off": {}, "trigger": {}, "reload": {}}}
  ])

async def handle_call_service(request):
  domain = request.match_info.get('domain')
  service = request.match_info.get('service')
  try:
    body = await request.json()
  except Exception:
    body = {}
  print(f"\n========================================================")
  print(f"[SERVICE CALL] Executing: {domain}.{service}")
  print(f"   Payload: {json.dumps(body, indent=2)}")
  print(f"========================================================\n")
  
  target_ids = body.get('entity_id') or body.get('target', {}).get('entity_id', [])
  if isinstance(target_ids, str):
    target_ids = [target_ids]
    
  affected_states = []
  for eid in target_ids:
    if eid in STATES:
      if service == 'turn_on':
        STATES[eid]['state'] = 'on'
      elif service == 'turn_off':
        STATES[eid]['state'] = 'off'
      elif service == 'toggle':
        STATES[eid]['state'] = 'off' if STATES[eid]['state'] == 'on' else 'on'
      affected_states.append(STATES[eid])
      
  return web.json_response(affected_states)

async def handle_automation_config_get(request):
  auto_id = request.match_info.get('automation_id')
  cfg = AUTOMATION_CONFIGS.get(auto_id)
  if cfg:
    return web.json_response(cfg)
  return web.json_response({
    "id": auto_id,
    "alias": f"Test Automation ({auto_id})",
    "trigger": [],
    "condition": [],
    "action": []
  })

async def handle_automation_post(request):
  body = await request.json()
  auto_id = body.get('id') or body.get('alias', 'new_automation').lower().replace(' ', '_')
  AUTOMATION_CONFIGS[auto_id] = body
  
  entity_id = f"automation.{auto_id}"
  STATES[entity_id] = {
    "entity_id": entity_id,
    "state": "on",
    "attributes": {
      "friendly_name": body.get('alias', auto_id),
      "id": auto_id
    },
    "last_changed": "2026-07-24T12:00:00.000Z",
    "last_updated": "2026-07-24T12:00:00.000Z"
  }
  print(f"\n========================================================")
  print(f"[AUTOMATION SAVED TO TEST HA] ID: {auto_id}")
  print(f"   Alias: {body.get('alias')}")
  print(f"   Config Payload: {json.dumps(body, indent=2)}")
  print(f"========================================================\n")
  return web.json_response({"result": "ok", "automation_id": auto_id})

async def handle_lovelace_config(request):
  return web.json_response({"title": "Test Dashboard", "views": []})

# WebSocket handler
async def handle_websocket(request):
  ws = web.WebSocketResponse()
  await ws.prepare(request)
  logger.info("[WS] Client connected")

  async for msg in ws:
    if msg.type == web.WSMsgType.TEXT:
      try:
        data = json.loads(msg.data)
        msg_type = data.get('type')
        msg_id = data.get('id')

        if msg_type == 'auth_required':
          await ws.send_json({"type": "auth_ok", "ha_version": "2026.7.0.test"})
        elif msg_type == 'auth':
          await ws.send_json({"type": "auth_ok", "ha_version": "2026.7.0.test"})
        elif msg_type == 'config/area_registry/list':
          await ws.send_json({"id": msg_id, "type": "result", "success": True, "result": AREAS})
        elif msg_type == 'config/device_registry/list':
          await ws.send_json({"id": msg_id, "type": "result", "success": True, "result": DEVICES})
        elif msg_type == 'config/entity_registry/list':
          await ws.send_json({"id": msg_id, "type": "result", "success": True, "result": ENTITIES_REGISTRY})
        else:
          await ws.send_json({"id": msg_id, "type": "result", "success": True, "result": []})
      except Exception as e:
        logger.error(f"WebSocket parse error: {e}")

  return ws

# Application Setup
app = web.Application(middlewares=[log_requests_middleware])
app.router.add_get('/api/', handle_api)
app.router.add_get('/api/config', handle_config)
app.router.add_get('/api/states', handle_states)
app.router.add_get('/api/states/{entity_id}', handle_state_get)
app.router.add_get('/api/services', handle_services)
app.router.add_post('/api/services/{domain}/{service}', handle_call_service)
app.router.add_get('/api/config/automation/config/{automation_id}', handle_automation_config_get)
app.router.add_post('/api/config/automation/config/{automation_id}', handle_automation_post)
app.router.add_post('/api/config/automation/config', handle_automation_post)
app.router.add_get('/api/lovelace/config', handle_lovelace_config)
app.router.add_get('/api/websocket', handle_websocket)

if __name__ == '__main__':
  print("==========================================================")
  print("[+] HOME ASSISTANT LIGHTWEIGHT TEST ENVIRONMENT SERVER")
  print("[+] Listening on: http://localhost:8123")
  print("[+] Token: test-token")
  print("==========================================================")
  web.run_app(app, port=8123)
