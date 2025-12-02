import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { app, shell } from 'electron';

const execAsync = promisify(exec);

export class SystemOperations {
  // File operations
  static async createFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createFile(filePath: string, content: string = ''): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async deleteFolder(folderPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Use rm with recursive option (Node.js 14.14.0+)
      await fs.promises.rm(folderPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      // Fallback to rmdir for older Node versions
      try {
        await (fs.promises as any).rmdir(folderPath, { recursive: true });
        return { success: true };
      } catch (fallbackError) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  }

  static async searchFiles(searchPath: string, pattern: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      // Use native file search (Windows: dir /s /b, Unix: find)
      const isWindows = process.platform === 'win32';
      const command = isWindows
        ? `dir /s /b "${searchPath}\\*${pattern}*" 2>nul`
        : `find "${searchPath}" -name "*${pattern}*" -type f 2>/dev/null`;
      
      const { stdout } = await execAsync(command);
      const files = stdout.split('\n').filter(f => f.trim()).map(f => f.trim());
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Application control
  static async openApplication(appName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        // Try to find and launch the application
        await shell.openPath(appName);
      } else {
        await execAsync(`open -a "${appName}"`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async closeApplication(processName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        await execAsync(`taskkill /IM "${processName}" /F`);
      } else {
        await execAsync(`pkill -f "${processName}"`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Development operations
  static async gitInit(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('git init', { cwd: projectPath });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createVirtualEnv(envPath: string, type: 'python' | 'node' = 'python'): Promise<{ success: boolean; error?: string }> {
    try {
      if (type === 'python') {
        await execAsync(`python -m venv "${envPath}"`);
      } else if (type === 'node') {
        await execAsync(`npm init -y`, { cwd: envPath });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async installDependencies(projectPath: string, packageManager: 'npm' | 'pip' = 'npm'): Promise<{ success: boolean; error?: string }> {
    try {
      if (packageManager === 'npm') {
        await execAsync('npm install', { cwd: projectPath });
      } else if (packageManager === 'pip') {
        await execAsync('pip install -r requirements.txt', { cwd: projectPath });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // System operations
  static async getSystemInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      let command: string;
      
      if (isWindows) {
        command = 'systeminfo | findstr /C:"Total Physical Memory" /C:"Available Physical Memory" /C:"OS Name" /C:"OS Version"';
      } else {
        command = 'uname -a && free -h && df -h';
      }
      
      const { stdout } = await execAsync(command);
      return { success: true, info: stdout };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async emptyTrash(): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        // Empty recycle bin using PowerShell (safer than rd command)
        await execAsync('powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"');
      } else {
        await execAsync('rm -rf ~/.Trash/*');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async shutdownSystem(delay: number = 0): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        await execAsync(`shutdown /s /t ${delay}`);
      } else {
        await execAsync(`shutdown -h +${Math.floor(delay / 60)}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async restartSystem(delay: number = 0): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        await execAsync(`shutdown /r /t ${delay}`);
      } else {
        await execAsync(`shutdown -r +${Math.floor(delay / 60)}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async sleepSystem(): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        await execAsync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
      } else {
        await execAsync('pmset sleepnow');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Media control (basic - can be extended with specific player APIs)
  static async takeScreenshot(outputPath?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      const screenshotPath = outputPath || path.join(app.getPath('desktop'), `screenshot-${Date.now()}.png`);
      
      if (isWindows) {
        // Windows: Use PowerShell to take screenshot
        await execAsync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('${screenshotPath}'); $graphics.Dispose(); $bmp.Dispose()"`);
      } else {
        await execAsync(`screencapture -x "${screenshotPath}"`);
      }
      return { success: true, path: screenshotPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Process management
  static async killProcess(processName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        await execAsync(`taskkill /F /IM "${processName}"`);
      } else {
        await execAsync(`pkill -9 "${processName}"`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async getRunningProcesses(): Promise<{ success: boolean; processes?: string[]; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'tasklist' : 'ps aux';
      const { stdout } = await execAsync(command);
      const processes = stdout.split('\n').filter(p => p.trim());
      return { success: true, processes };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

