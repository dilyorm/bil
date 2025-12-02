import { api } from './api';

export interface DesktopCommand {
  action: 'open_app' | 'run_command' | 'ssh_connect' | 'custom_script';
  target: string;
  args?: string[];
  password?: string;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  message: string;
}

class DesktopControlService {
  /**
   * Send command to desktop computer
   */
  async sendCommand(
    deviceId: string,
    command: DesktopCommand
  ): Promise<CommandResult> {
    try {
      const response = await api.post('/desktop-agent/command', {
        deviceId,
        action: command.action,
        target: command.target,
        args: command.args,
        password: command.password,
      });

      return response.data;
    } catch (error) {
      console.error('Error sending desktop command:', error);
      throw error;
    }
  }

  /**
   * Open an application on desktop
   */
  async openApp(deviceId: string, appName: string): Promise<CommandResult> {
    return this.sendCommand(deviceId, {
      action: 'open_app',
      target: appName,
    });
  }

  /**
   * Run a shell command on desktop
   */
  async runCommand(
    deviceId: string,
    command: string,
    args?: string[]
  ): Promise<CommandResult> {
    return this.sendCommand(deviceId, {
      action: 'run_command',
      target: command,
      args,
    });
  }

  /**
   * SSH connect from desktop
   */
  async sshConnect(
    deviceId: string,
    target: string,
    password?: string
  ): Promise<CommandResult> {
    return this.sendCommand(deviceId, {
      action: 'ssh_connect',
      target,
      password,
    });
  }

  /**
   * Parse natural language command and send to desktop
   */
  async sendNaturalCommand(
    deviceId: string,
    naturalCommand: string
  ): Promise<CommandResult> {
    // Parse common commands
    const lower = naturalCommand.toLowerCase();

    if (lower.includes('open steam')) {
      return this.openApp(deviceId, 'steam');
    }

    if (lower.includes('cs2') || lower.includes('counter strike')) {
      return this.openApp(deviceId, 'cs2');
    }

    if (lower.includes('spotify')) {
      return this.openApp(deviceId, 'spotify');
    }

    if (lower.includes('faceit')) {
      return this.openApp(deviceId, 'faceit');
    }

    if (lower.includes('cursor')) {
      return this.openApp(deviceId, 'cursor');
    }

    // SSH commands
    const sshMatch = lower.match(/ssh (?:to |into )?(.+)/);
    if (sshMatch) {
      return this.sshConnect(deviceId, sshMatch[1]);
    }

    throw new Error('Could not understand command');
  }

  /**
   * Get command history
   */
  async getCommandHistory(): Promise<any[]> {
    try {
      const response = await api.get('/desktop-agent/history');
      return response.data.commands;
    } catch (error) {
      console.error('Error fetching command history:', error);
      return [];
    }
  }
}

export const desktopControl = new DesktopControlService();
