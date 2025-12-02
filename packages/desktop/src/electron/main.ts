import { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { SystemOperations } from './system-ops';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let floatingWindow: BrowserWindow | null = null;

// Extend the app interface to include our custom property
declare global {
  interface ElectronApp {
    isQuiting?: boolean;
  }
}

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify();

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Enable media access for microphone
      allowRunningInsecureContent: false,
      webSecurity: true,
    },
  });

  // Handle permission requests
  // Note: Media permissions (microphone/camera) are handled automatically by Electron
  // when getUserMedia() is called in the renderer process.
  // For a desktop app, we can be more permissive with permissions from our own origin.
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, _details) => {
      // Allow common permissions needed for the desktop app
      // Media access (microphone/camera) is handled automatically by Electron
      const allowedPermissions = [
        'notifications',
        'geolocation',
        'midi',
        'midiSysex',
        'pointerLock',
        'fullscreen',
        'openExternal',
      ];
      
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        // For unknown permissions, allow if from our app origin (desktop app security model)
        // Media permissions are automatically granted when getUserMedia() is called
        callback(true);
      }
    }
  );

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('app.isPackaged:', app.isPackaged);
  
  if (isDev) {
    console.log('Loading development URL: http://localhost:5173');
    
    // Add a small delay to ensure Vite server is ready
    const loadWithRetry = async (retries = 5) => {
      for (let i = 0; i < retries; i++) {
        try {
          await mainWindow!.loadURL('http://localhost:5173');
          console.log('Successfully loaded development URL');
          break;
        } catch (err) {
          console.error(`Attempt ${i + 1} failed to load URL:`, err);
          if (i < retries - 1) {
            console.log('Retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };
    
    loadWithRetry();

    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    // In production: build folder is unpacked from asar due to asarUnpack configuration
    // Try multiple possible locations for the build files
    (async () => {
      try {
        const appPath = app.getAppPath();
        const resourcesPath = process.resourcesPath || path.dirname(appPath);
        
        // Possible paths (in order of likelihood):
        // 1. Relative to main.js (when build is in asar)
        // 2. In app.getAppPath()/build (when build is in asar)
        // 3. In resources/app.asar.unpacked/build (when unpacked)
        // 4. In resources/build (when unpacked to resources)
        const possiblePaths = [
          path.join(__dirname, '../build/index.html'),
          path.join(appPath, 'build', 'index.html'),
          path.join(resourcesPath, 'app.asar.unpacked', 'build', 'index.html'),
          path.join(resourcesPath, 'build', 'index.html'),
          path.join(path.dirname(appPath), 'build', 'index.html'),
        ];
        
        let htmlPath: string | null = null;
        for (const tryPath of possiblePaths) {
          try {
            if (fs.existsSync(tryPath)) {
              htmlPath = tryPath;
              console.log('Found build file at:', htmlPath);
              break;
            }
          } catch (err) {
            // Continue to next path
          }
        }
        
        if (htmlPath) {
          await mainWindow!.loadFile(htmlPath);
        } else {
          // Last resort: try to construct a file URL
          // When files are in asar, we can load them directly
          const defaultPath = path.join(appPath, 'build', 'index.html');
          console.log('Attempting to load from app path (may be in asar):', defaultPath);
          try {
            await mainWindow!.loadFile(defaultPath);
          } catch (loadError) {
            console.error('Failed to load file, trying URL:', loadError);
            // Try as file URL
            const fileUrl = `file:///${defaultPath.replace(/\\\\/g, '/')}`;
            await mainWindow!.loadURL(fileUrl);
          }
        }
      } catch (error) {
        console.error('Error loading production file:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const appPath = app.getAppPath();
        const errorHtml = `data:text/html,<html><head><title>Error</title><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5;"><div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"><h1 style="color: #d32f2f;">Application Loading Error</h1><p>Could not load the application files.</p><p style="color: #666; font-size: 14px; margin-top: 20px;"><strong>Error:</strong> ${errorMsg}</p><p style="color: #666; font-size: 14px;"><strong>App path:</strong> ${appPath}</p><p style="color: #666; font-size: 14px;"><strong>Resources path:</strong> ${process.resourcesPath || 'N/A'}</p><p style="color: #666; font-size: 14px; margin-top: 20px;">Please rebuild the application: <code>npm run build</code></p></div></body></html>`;
        await mainWindow!.loadURL(errorHtml);
      }
    })();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow?.show();
  });

  // Add web contents event listeners for debugging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Web contents finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Web contents failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
}

function createFloatingWindow() {
  floatingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Enable media access for microphone
      allowRunningInsecureContent: false,
      webSecurity: true,
    },
  });

  // Handle permission requests
  // Note: Media permissions (microphone/camera) are handled automatically by Electron
  // when getUserMedia() is called in the renderer process.
  // For a desktop app, we can be more permissive with permissions from our own origin.
  floatingWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, _details) => {
      // Allow common permissions needed for the desktop app
      // Media access (microphone/camera) is handled automatically by Electron
      const allowedPermissions = [
        'notifications',
        'geolocation',
        'midi',
        'midiSysex',
        'pointerLock',
        'fullscreen',
        'openExternal',
      ];
      
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        // For unknown permissions, allow if from our app origin (desktop app security model)
        // Media permissions are automatically granted when getUserMedia() is called
        callback(true);
      }
    }
  );

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    floatingWindow.loadURL('http://localhost:5173#/floating');
  } else {
    // Use same loading logic as main window
    (async () => {
      try {
        const appPath = app.getAppPath();
        const resourcesPath = process.resourcesPath || path.dirname(appPath);
        
        const possiblePaths = [
          path.join(__dirname, '../build/index.html'),
          path.join(appPath, 'build', 'index.html'),
          path.join(resourcesPath, 'app.asar.unpacked', 'build', 'index.html'),
          path.join(resourcesPath, 'build', 'index.html'),
        ];
        
        let htmlPath: string | null = null;
        for (const tryPath of possiblePaths) {
          if (fs.existsSync(tryPath)) {
            htmlPath = tryPath;
            break;
          }
        }
        
        if (htmlPath) {
          await floatingWindow!.loadFile(htmlPath, { hash: 'floating' });
        } else {
          const defaultPath = path.join(appPath, 'build', 'index.html');
          await floatingWindow!.loadFile(defaultPath, { hash: 'floating' });
        }
      } catch (error) {
        console.error('Error loading floating window:', error);
      }
    })();
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });

  return floatingWindow;
}

function resolveAssetPath(filename: string) {
  const devPath = path.join(__dirname, '../../assets', filename);
  const prodPath = path.join(__dirname, '../assets', filename);
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function createTray() {
  try {
    const trayIconPath = resolveAssetPath('tray-icon.png');
    tray = new Tray(trayIconPath);
  } catch (error) {
    console.warn('Could not load tray icon, using default:', error);
    // Create a simple tray without custom icon
    tray = new Tray(require('electron').nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show BIL Assistant',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Floating Assistant',
      type: 'checkbox',
      checked: floatingWindow !== null,
      click: () => {
        if (floatingWindow) {
          floatingWindow.close();
        } else {
          const newFloatingWindow = createFloatingWindow();
          newFloatingWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate-to', '/settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as ElectronApp).isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('BIL Assistant');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

function registerGlobalShortcuts() {
  // Global shortcut to show/hide main window
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });

  // Global shortcut to toggle floating window
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (floatingWindow) {
      if (floatingWindow.isVisible()) {
        floatingWindow.hide();
      } else {
        floatingWindow.show();
        floatingWindow.focus();
      }
    } else {
      const newFloatingWindow = createFloatingWindow();
      newFloatingWindow.show();
    }
  });

  // Global shortcut for quick voice input
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('trigger-voice-input');
    }
  });
}

// App event handlers
app.whenReady().then(() => {
  createMainWindow();
  createTray();
  registerGlobalShortcuts();

  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.bil.desktop');
  }

  // Basic intent execution: open URLs or applications
  ipcMain.handle('execute-intent', async (_event, intent: { type: string; payload?: any }) => {
    try {
      if (!intent || !intent.type) return { success: false, error: 'Invalid intent' };

      // Normalize intent type (handle variations like 'take-screenshot' -> 'take_screenshot')
      const normalizedType = intent.type.toLowerCase().replace(/\s|-/g, '_');
      console.log('Executing intent:', normalizedType, 'payload:', intent.payload);

      switch (normalizedType) {
        case 'open_url': {
          let url = intent.payload?.url as string | undefined;
          if (!url) return { success: false, error: 'Missing url' };
          // Keyword/site mapping and normalization
          const siteMap: Record<string, string> = {
            youtube: 'https://www.youtube.com/',
            'youtube.com': 'https://www.youtube.com/',
            google: 'https://www.google.com/',
            gmail: 'https://mail.google.com/',
            twitter: 'https://twitter.com/',
            x: 'https://twitter.com/',
            reddit: 'https://www.reddit.com/',
            github: 'https://github.com/',
          };
          const trimmed = url.trim().toLowerCase();
          if (siteMap[trimmed]) {
            url = siteMap[trimmed];
          } else {
            // Normalize missing protocol
            if (!/^https?:\/\//i.test(url)) {
              url = `https://${url}`;
            }
          }
          await shell.openExternal(url);
          return { success: true };
        }
        case 'open_path': {
          const targetPath = intent.payload?.path as string | undefined;
          if (!targetPath) return { success: false, error: 'Missing path' };
          const result = await shell.openPath(targetPath);
          if (result) return { success: false, error: result };
          return { success: true };
        }
        case 'run_script': {
          const language = intent.payload?.language as string | undefined;
          const script = intent.payload?.script as string | undefined;
          const args = (intent.payload?.args as string[] | undefined) || [];
          if (!language || !script) return { success: false, error: 'Missing language or script' };

          // Only allow python for now
          if (language !== 'python') return { success: false, error: 'Unsupported language' };

          // Try python, then py (Windows launcher)
          const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
          const spawnScript = (cmd: string) => new Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>((resolve) => {
            // Use shell: true on Windows to ensure proper command execution
            const spawnOptions: any = {
              shell: process.platform === 'win32',
            };
            
            const { spawn } = require('child_process');
            const cp = spawn(cmd, [script, ...args], spawnOptions);
            let stdout = '';
            let stderr = '';
            cp.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
            cp.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
            cp.on('close', (code: number) => {
              if (code === 0) resolve({ success: true, stdout });
              else resolve({ success: false, stderr, error: `Exit code ${code}` });
            });
            cp.on('error', (err: Error) => resolve({ success: false, error: err.message }));
          });

          for (const cmd of candidates) {
            const result = await spawnScript(cmd);
            if (result.success) return result;
            // If command not found, try next candidate
            if (result.error && /not found|ENOENT/i.test(result.error)) continue;
            // If executed but failed, return its output
            if (!result.success) return result;
          }
          return { success: false, error: 'Python not available' };
        }
        case 'execute_command': {
          // Generic command execution (with security considerations)
          const command = intent.payload?.command as string | undefined;
          const commandArgs = (intent.payload?.args as string[] | undefined) || [];
          const workingDir = intent.payload?.workingDir as string | undefined;
          
          if (!command) return { success: false, error: 'Missing command' };

          // Security: Only allow safe commands (whitelist approach)
          const allowedCommands = ['python', 'py', 'python3', 'node', 'npm', 'npx', 'git', 'code', 'cursor'];
          const commandName = command.split(/[\/\\]/).pop()?.toLowerCase() || '';
          
          if (!allowedCommands.some(allowed => commandName.startsWith(allowed))) {
            return { success: false, error: 'Command not allowed for security reasons' };
          }

          return new Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>((resolve) => {
            const spawnOptions: any = {
              shell: process.platform === 'win32',
              cwd: workingDir || process.cwd(),
            };
            
            const { spawn } = require('child_process');
            const cp = spawn(command, commandArgs, spawnOptions);
            let stdout = '';
            let stderr = '';
            cp.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
            cp.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
            cp.on('close', (code: number) => {
              if (code === 0) resolve({ success: true, stdout });
              else resolve({ success: false, stderr, error: `Exit code ${code}` });
            });
            cp.on('error', (err: Error) => resolve({ success: false, error: err.message }));
          });
        }
        // File operations
        case 'create_folder': {
          const folderPath = intent.payload?.path as string | undefined;
          if (!folderPath) return { success: false, error: 'Missing folder path' };
          return await SystemOperations.createFolder(folderPath);
        }
        case 'create_file': {
          const filePath = intent.payload?.path as string | undefined;
          const content = intent.payload?.content as string | undefined || '';
          if (!filePath) return { success: false, error: 'Missing file path' };
          return await SystemOperations.createFile(filePath, content);
        }
        case 'delete_file': {
          const filePath = intent.payload?.path as string | undefined;
          if (!filePath) return { success: false, error: 'Missing file path' };
          return await SystemOperations.deleteFile(filePath);
        }
        case 'delete_folder': {
          const folderPath = intent.payload?.path as string | undefined;
          if (!folderPath) return { success: false, error: 'Missing folder path' };
          return await SystemOperations.deleteFolder(folderPath);
        }
        case 'search_files': {
          const searchPath = intent.payload?.path as string | undefined || process.cwd();
          const pattern = intent.payload?.pattern as string | undefined;
          if (!pattern) return { success: false, error: 'Missing search pattern' };
          return await SystemOperations.searchFiles(searchPath, pattern);
        }
        // Application control
        case 'open_application': {
          const appName = intent.payload?.name as string | undefined;
          if (!appName) return { success: false, error: 'Missing application name' };
          return await SystemOperations.openApplication(appName);
        }
        case 'close_application': {
          const processName = intent.payload?.name as string | undefined;
          if (!processName) return { success: false, error: 'Missing process name' };
          return await SystemOperations.closeApplication(processName);
        }
        // Development operations
        case 'git_init': {
          const projectPath = intent.payload?.path as string | undefined || process.cwd();
          return await SystemOperations.gitInit(projectPath);
        }
        case 'create_virtual_env': {
          const envPath = intent.payload?.path as string | undefined;
          const type = (intent.payload?.type as 'python' | 'node') || 'python';
          if (!envPath) return { success: false, error: 'Missing environment path' };
          return await SystemOperations.createVirtualEnv(envPath, type);
        }
        case 'install_dependencies': {
          const projectPath = intent.payload?.path as string | undefined || process.cwd();
          const packageManager = (intent.payload?.packageManager as 'npm' | 'pip') || 'npm';
          return await SystemOperations.installDependencies(projectPath, packageManager);
        }
        // System operations
        case 'get_system_info': {
          return await SystemOperations.getSystemInfo();
        }
        case 'empty_trash': {
          return await SystemOperations.emptyTrash();
        }
        case 'shutdown': {
          const delay = (intent.payload?.delay as number) || 0;
          return await SystemOperations.shutdownSystem(delay);
        }
        case 'restart': {
          const delay = (intent.payload?.delay as number) || 0;
          return await SystemOperations.restartSystem(delay);
        }
        case 'sleep': {
          return await SystemOperations.sleepSystem();
        }
        case 'take_screenshot': {
          const outputPath = intent.payload?.path as string | undefined;
          return await SystemOperations.takeScreenshot(outputPath);
        }
        case 'kill_process': {
          const processName = intent.payload?.name as string | undefined;
          if (!processName) return { success: false, error: 'Missing process name' };
          return await SystemOperations.killProcess(processName);
        }
        case 'get_processes': {
          return await SystemOperations.getRunningProcesses();
        }
        // Open IDE with project
        case 'open_in_ide': {
          const projectPath = intent.payload?.path as string | undefined || process.cwd();
          const ide = (intent.payload?.ide as string) || 'code'; // 'code' or 'cursor'
          try {
            if (ide === 'cursor') {
              await shell.openPath(`cursor://file/${projectPath}`);
            } else {
              await shell.openPath(`vscode://file/${projectPath}`);
            }
            return { success: true };
          } catch (error) {
            // Fallback: try opening with command
            const isWindows = process.platform === 'win32';
            const command = isWindows ? `${ide} "${projectPath}"` : `open -a "${ide}" "${projectPath}"`;
            const { exec } = require('child_process');
            exec(command, (err: Error) => {
              if (err) console.error('Failed to open IDE:', err);
            });
            return { success: true };
          }
        }
        default:
          console.error('Unsupported intent type:', normalizedType, 'original:', intent.type);
          return { success: false, error: `Unsupported intent: ${normalizedType} (original: ${intent.type})` };
      }
    } catch (err) {
      console.error('Error executing intent:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app running in background on all platforms
  // Don't quit the app when all windows are closed
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-floating-window', () => {
  if (!floatingWindow) {
    floatingWindow = createFloatingWindow();
  }
  floatingWindow.show();
  floatingWindow.focus();
});

ipcMain.handle('hide-floating-window', () => {
  floatingWindow?.hide();
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.filePaths;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  
  return result.filePaths[0];
});

// Desktop Agent IPC handlers
import { agentService } from './agent-service';

ipcMain.handle('start-desktop-agent', async (_event, authToken: string) => {
  console.log('🤖 Starting desktop agent from renderer...');
  agentService.start(authToken);
});

ipcMain.handle('stop-desktop-agent', async () => {
  console.log('🛑 Stopping desktop agent from renderer...');
  agentService.stop();
});

ipcMain.handle('execute-agent-command', async (_event, command: any) => {
  console.log('⚡ Executing agent command from renderer:', command);
  return await agentService.executeNaturalLanguage(command);
});
