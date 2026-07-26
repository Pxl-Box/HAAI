import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom frameless desktop window
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Needed for local network CORS when connecting to local HA / Ollama instances
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // When packaged with electron-builder, index.html is located under app.getAppPath()/dist/index.html
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window controls IPC
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

// Digital Twin local file system storage IPC handlers (Documents/HAAI_Digital_Twin)
import * as fs from 'fs';

const getDigitalTwinDirPath = () => {
  let documentsPath = app.getPath('documents');
  
  // Windows OneDrive path fallback if standard documents path differs
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  if (userProfile && process.platform === 'win32') {
    const oneDriveDocs = path.join(userProfile, 'OneDrive', 'Documents');
    const stdDocs = path.join(userProfile, 'Documents');
    if (fs.existsSync(oneDriveDocs)) {
      documentsPath = oneDriveDocs;
    } else if (fs.existsSync(stdDocs)) {
      documentsPath = stdDocs;
    }
  }

  const twinDir = path.join(documentsPath, 'HAAI_Digital_Twin');
  if (!fs.existsSync(twinDir)) {
    fs.mkdirSync(twinDir, { recursive: true });
  }
  return twinDir;
};

ipcMain.handle('save-digital-twin-files', async (_event, twinData: any) => {
  try {
    const twinDir = getDigitalTwinDirPath();
    const mainFilePath = path.join(twinDir, 'digital_twin_source_of_truth.json');
    const summaryFilePath = path.join(twinDir, 'digital_twin_summary.md');

    const brainFilePath = path.join(twinDir, 'brain.md');

    // Save main JSON Digital Twin file
    fs.writeFileSync(mainFilePath, JSON.stringify(twinData, null, 2), 'utf-8');

    // Save human-readable Markdown summary file
    const markdownSummary = `# HAAI Digital Twin Source of Truth
Last Updated: ${twinData.lastUpdated || new Date().toISOString()}

## Overview
- Total Entities: ${twinData.entityCount || twinData.states?.length || 0}
- Areas: ${twinData.areas?.length || 0}
- Floors: ${twinData.floors?.length || 0}
- Devices: ${twinData.devices?.length || 0}
- Integrations: ${twinData.integrations?.length || 0}
- Automations: ${Object.keys(twinData.automationConfigs || {}).length}

## Areas & Floors
${(twinData.areas || []).map((a: any) => `- Area: ${a.name} (ID: ${a.area_id}, Floor ID: ${a.floor_id || 'none'})`).join('\n')}

## Hardware Devices
${(twinData.devices || []).map((d: any) => `- Device: ${d.name || d.id} (${d.manufacturer || 'Generic'} ${d.model || ''})`).join('\n')}
`;

    fs.writeFileSync(summaryFilePath, markdownSummary, 'utf-8');

    // Save Brain Memory file (brain.md) for cross-session AI learning
    const brainMarkdown = `# HAAI Persistent Agent Brain & Learned User Knowledge
Last Updated: ${new Date().toISOString()}

This document contains persistent key facts, user preferences, custom naming rules, hardware notes, and household instructions learned by HAAI from user conversations. Any AI model referencing this source of truth should adhere to these instructions.

## Learned Household Instructions & User Preferences:
${(twinData.brainMemory && twinData.brainMemory.length > 0)
    ? twinData.brainMemory.map((fact: string) => `• ${fact}`).join('\n')
    : '• (No custom user preferences or rules added yet. Use the Brain Memory interface in HAAI Settings to add permanent preferences.)'}
`;

    fs.writeFileSync(brainFilePath, brainMarkdown, 'utf-8');

    return { success: true, dirPath: twinDir, filePath: mainFilePath, brainPath: brainFilePath };
  } catch (err: any) {
    console.error('Failed to save Digital Twin to Documents folder:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-digital-twin-files', async () => {
  try {
    const twinDir = getDigitalTwinDirPath();
    const mainFilePath = path.join(twinDir, 'digital_twin_source_of_truth.json');
    if (fs.existsSync(mainFilePath)) {
      const content = fs.readFileSync(mainFilePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to load Digital Twin from Documents folder:', err);
  }
  return null;
});
