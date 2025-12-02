import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CommandAction {
  type: 'open_app' | 'run_command' | 'ssh_connect' | 'custom_script';
  target: string;
  args?: string[];
  workingDir?: string;
  password?: string; // For SSH or sudo commands
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  pid?: number;
}

export class DesktopAgent {
  private runningProcesses: Map<number, any> = new Map();
  private platform: string;

  constructor() {
    this.platform = os.platform();
  }

  /**
   * Execute a command action from mobile
   */
  async executeAction(action: CommandAction): Promise<CommandResult> {
    console.log('🤖 Desktop Agent executing:', action);

    try {
      switch (action.type) {
        case 'open_app':
          return await this.openApplication(action.target);
        
        case 'run_command':
          return await this.runCommand(action.target, action.args, action.workingDir);
        
        case 'ssh_connect':
          return await this.sshConnect(action.target, action.password);
        
        case 'custom_script':
          return await this.runCustomScript(action.target, action.args);
        
        default:
          return {
            success: false,
            error: `Unknown action type: ${action.type}`
          };
      }
    } catch (error) {
      console.error('❌ Desktop Agent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Open an application (Steam, Spotify, CS2, etc.)
   */
  private async openApplication(appName: string): Promise<CommandResult> {
    const appCommands: Record<string, Record<string, string>> = {
      win32: {
        steam: 'start steam://open/main',
        cs2: 'start steam://rungameid/730',
        spotify: 'start spotify:',
        faceit: 'start https://www.faceit.com',
        cursor: 'start cursor',
        chrome: 'start chrome',
        discord: 'start discord',
      },
      darwin: {
        steam: 'open -a Steam',
        cs2: 'open steam://rungameid/730',
        spotify: 'open -a Spotify',
        faceit: 'open https://www.faceit.com',
        cursor: 'open -a Cursor',
        chrome: 'open -a "Google Chrome"',
        discord: 'open -a Discord',
      },
      linux: {
        steam: 'steam',
        cs2: 'steam steam://rungameid/730',
        spotify: 'spotify',
        faceit: 'xdg-open https://www.faceit.com',
        cursor: 'cursor',
        chrome: 'google-chrome',
        discord: 'discord',
      }
    };

    const command = appCommands[this.platform]?.[appName.toLowerCase()];
    
    if (!command) {
      return {
        success: false,
        error: `Application "${appName}" not found for platform ${this.platform}`
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        output: `Opened ${appName}. ${stdout || ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open application'
      };
    }
  }

  /**
   * Run a shell command
   */
  private async runCommand(
    command: string, 
    args?: string[], 
    workingDir?: string
  ): Promise<CommandResult> {
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    const options = workingDir ? { cwd: workingDir } : {};

    try {
      const { stdout } = await execAsync(fullCommand, options);
      return {
        success: true,
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed'
      };
    }
  }

  /**
   * SSH connect and execute commands
   */
  private async sshConnect(target: string, _password?: string): Promise<CommandResult> {
    try {
      // For SSH, we spawn a process that stays open
      const child = spawn('ssh', [target], {
        stdio: 'pipe'
      });

      if (child.pid) {
        this.runningProcesses.set(child.pid, child);
      }

      const result: CommandResult = {
        success: true,
        output: `SSH connection initiated to ${target}`
      };
      
      if (child.pid) {
        result.pid = child.pid;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSH connection failed'
      };
    }
  }

  /**
   * Run a custom script
   */
  private async runCustomScript(scriptPath: string, args?: string[]): Promise<CommandResult> {
    const fullPath = path.resolve(scriptPath);
    const command = `${fullPath} ${args?.join(' ') || ''}`;

    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Script execution failed'
      };
    }
  }

  /**
   * Parse natural language command to action
   */
  parseNaturalLanguage(command: string): CommandAction | null {
    const lower = command.toLowerCase();

    // Open Steam
    if (lower.includes('open steam') || lower.includes('launch steam')) {
      return { type: 'open_app', target: 'steam' };
    }

    // Open CS2
    if (lower.includes('cs2') || lower.includes('counter strike')) {
      return { type: 'open_app', target: 'cs2' };
    }

    // Open Spotify
    if (lower.includes('spotify') || lower.includes('music')) {
      return { type: 'open_app', target: 'spotify' };
    }

    // Open Faceit
    if (lower.includes('faceit')) {
      return { type: 'open_app', target: 'faceit' };
    }

    // Open Cursor
    if (lower.includes('cursor') || lower.includes('code editor')) {
      return { type: 'open_app', target: 'cursor' };
    }

    // SSH commands
    const sshMatch = lower.match(/ssh (?:to |into )?(.+)/);
    if (sshMatch && sshMatch[1]) {
      return { type: 'ssh_connect', target: sshMatch[1] };
    }

    return null;
  }

  /**
   * Kill a running process
   */
  killProcess(pid: number): boolean {
    const process = this.runningProcesses.get(pid);
    if (process) {
      process.kill();
      this.runningProcesses.delete(pid);
      return true;
    }
    return false;
  }

  /**
   * Get list of running processes managed by agent
   */
  getRunningProcesses(): number[] {
    return Array.from(this.runningProcesses.keys());
  }
}

export const desktopAgent = new DesktopAgent();
