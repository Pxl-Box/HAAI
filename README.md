# HAAI (Home Assistant AI Assistant)

> A high-performance desktop application for Windows engineered to combine localized heavy-lifting telemetry pre-processing with multi-model AI logic to manage, automate, inspect, and repair Home Assistant instances.

HAAI acts as an autonomous smart home copilot. It pre-processes your local Home Assistant entity inventory, physical area mapping, and system health diagnostics locally before presenting optimized context to local or cloud-based Large Language Models.

---

## Key Features

- **Local Telemetry Pre-Processing**: Automatically parses physical room structures, categorizes device types (separating physical light entities from IR camera LEDs), inventories installed HACS custom cards, and monitors offline device diagnostics.
- **Multi-Provider AI Engine**: Seamless support for local LLMs (**Ollama**, **LM Studio**, **Jan.ai**) and cloud AI APIs (**Google Gemini**, **Anthropic Claude**, **OpenAI**, **DeepSeek**, **Groq**, **OpenRouter**, **Mistral**).
- **Live Automation & Script Management**: Intercepts generated automation configurations and applies them directly to live Home Assistant instances via WebSocket & REST APIs with instant engine reloading.
- **YAML Validation & Safety**: Built-in YAML syntax and safety checking ensuring syntactically valid automation and script execution.
- **Lovelace Dashboard Inspection**: Inspects and updates Lovelace view layouts and custom card definitions.
- **Conflict Resolution and Entity Safety**: Analyzes entity renaming impact across scripts, automations, and dashboards to prevent broken dependencies.
- **Local Testing Environment**: Includes automated Docker/Python test launcher script (`start_test_ha.bat`) for isolated local Home Assistant development.

---

## Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Home Assistant**: A running Home Assistant instance with a Long-Lived Access Token created under **User Profile > Long-Lived Access Tokens**.

---

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/HAAI.git
   cd HAAI
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

---

## Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Launches the Vite dev server and Electron desktop application concurrently in development mode. |
| `npm run build:electron` | Compiles TypeScript files for the Electron main/preload process and builds the production React application with Vite. |
| `npm run dist` | Compiles all assets and packages the app into a standalone Windows executable (`nsis` installer & `portable` binaries) via `electron-builder`. |

---

## Running in Development Mode

To launch the desktop application in Electron development mode:

```bash
npm run dev
```

---

## Packaging for Production

To build and package the standalone Windows application binaries:

```bash
npm run dist
```

The output executables will be generated in `builds/win` (with build outputs in `dist` and `dist-electron`).

---

## Getting Started

1. **Initial Setup**: Upon launching HAAI for the first time, complete the onboarding wizard.
2. **Home Assistant Connection**: Enter your Home Assistant URL (for example, `http://homeassistant.local:8123` or `http://localhost:8123`) and your Long-Lived Access Token.
3. **Select AI Provider**: Choose your preferred local LLM endpoint (such as Ollama on `http://localhost:11434`) or enter your API key for cloud providers like Google Gemini, Claude, or OpenAI.
4. **Interact and Automate**: Use the chat interface or specialized quick assistant tools to analyze, automate, and monitor your smart home.

---

## Project Structure

```text
HAAI/
├── electron/                 # Electron main & preload process scripts
│   ├── main.ts               # Native window setup, IPC handlers, app lifecycle
│   └── preload.ts            # Context isolation & safe API exposure
├── src/
│   ├── components/           # React components
│   │   ├── Chat/             # AI chat workspace, messages, quick actions
│   │   ├── Onboarding/       # Setup wizard & connection configuration
│   │   ├── Settings/         # Provider & Home Assistant preferences modal
│   │   ├── Sidebar/          # Navigation, history, system diagnostics view
│   │   └── Titlebar.tsx      # Custom window titlebar with controls
│   ├── services/
│   │   ├── ai/               # Multi-provider AI manager, prompts, YAML validator
│   │   ├── haClient.ts       # Home Assistant WebSocket & REST API service
│   │   ├── haTools.ts        # Tool definitions for AI execution
│   │   ├── localPreProcessor.ts # Telemetry, entity, and system health parser
│   │   └── storage.ts        # Persistent application & credentials storage
│   ├── App.tsx               # Main application component & layout
│   ├── index.css             # Tailwind CSS / Design system styles
│   └── main.tsx              # React DOM entry point
├── start_test_ha.bat         # Automated local test environment launcher
├── tsconfig.json             # React TypeScript configuration
├── tsconfig.electron.json    # Electron TypeScript configuration
├── vite.config.ts            # Vite bundler configuration
└── package.json              # App metadata, dependencies, build scripts
```

---

## Testing Environment Setup

To run a quick local Home Assistant instance for testing and evaluation without modifying your production server, execute:

```cmd
start_test_ha.bat
```

This script will attempt to start an official Home Assistant Docker container (`homeassistant/home-assistant:stable`) on port `8123`. If Docker is not available, it automatically falls back to a lightweight local Python test server.

---

## License

This project is licensed under the [MIT License](LICENSE).
