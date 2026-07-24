# HAAI (Home Assistant AI Manager)

A high-performance desktop application for Windows engineered to combine localized heavy-lifting telemetry pre-processing with multi-model AI logic to manage, automate, inspect, and repair Home Assistant instances.

HAAI acts as an autonomous smart home copilot. It pre-processes your local Home Assistant entity inventory, physical area mapping, and system health diagnostics locally before presenting optimized context to local or cloud-based Large Language Models.

---

## Purpose and Key Features

- **Local Telemetry Pre-Processing**: Automatically parses physical room structures, categorizes device types (separating physical light entities from IR camera LEDs), inventories installed HACS custom cards, and monitors offline device diagnostics.
- **Multi-Provider AI Engine**: Seamless support for local LLMs (Ollama, LM Studio, Jan.ai) and cloud AI APIs (Google Gemini, Anthropic Claude, OpenAI, DeepSeek, Groq, OpenRouter, Mistral).
- **Direct Live Automation Management**: Intercepts generated automation configurations and applies them directly to live Home Assistant instances via REST APIs with instant engine reloading.
- **Lovelace Dashboard Re-Architecting**: Inspects and updates Lovelace view layouts and custom card definitions.
- **Conflict Resolution and Entity Safety**: Analyzes entity renaming impact across scripts, automations, and dashboards to prevent broken dependencies.
- **Flexible Exporters and Commit Workflow**: Provides instant file export tools and single-click commit controls for live automation application.

---

## Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **Home Assistant**: A running Home Assistant instance with a Long-Lived Access Token created under User Profile > Long-Lived Access Tokens.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/HAAI.git
   ```

2. Navigate into the project directory:
   ```bash
   cd HAAI
   ```

3. Install project dependencies:
   ```bash
   npm install
   ```

---

## Running in Development Mode

To launch the desktop application in Electron development mode:

```bash
npm run dev
```

---

## Building for Production

To compile and package the desktop application into a standalone Windows executable:

```bash
npm run build
```

The output binary will be generated inside the `dist` and `dist-electron` directories.

---

## Getting Started

1. **Initial Setup**: Upon launching HAAI for the first time, complete the 2-step onboarding wizard.
2. **Home Assistant Connection**: Enter your Home Assistant URL (for example, `http://homeassistant.local:8123`) and your Long-Lived Access Token.
3. **Select AI Provider**: Choose your preferred local LLM endpoint (such as Ollama on `http://localhost:11434`) or enter your API key for cloud providers like Google Gemini or OpenAI.
4. **Interact and Automate**: Use the chat interface or pre-built quick agents (Lighting, Security, Dashboard, Refactor) to manage your smart home.

---

## Architecture Overview

- **Electron + Vite + React + TypeScript**: Native desktop frame with dark-mode aesthetic interface.
- **HAService (`src/services/haClient.ts`)**: Manages REST API communication with Home Assistant endpoints.
- **LocalPreProcessor (`src/services/localPreProcessor.ts`)**: Performs client-side telemetry analysis and prompt optimization.
- **AIManager (`src/services/ai/aiManager.ts`)**: Multi-provider handler that formats requests and executes tool calls across AI providers.

---

## License

This project is licensed under the MIT License.
