import { desktopAgent, CommandAction, CommandResult } from './agent';
import axios from 'axios';

export class DesktopAgentService {
  private apiUrl: string;
  private authToken: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(apiUrl: string = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  /**
   * Start the desktop agent service
   */
  start(authToken: string) {
    if (this.isRunning) {
      console.log('⚠️ Desktop agent already running');
      return;
    }

    this.authToken = authToken;
    this.isRunning = true;

    console.log('🤖 Starting desktop agent service...');
    
    // Poll for commands every 3 seconds
    this.pollingInterval = setInterval(() => {
      this.pollForCommands();
    }, 3000);

    console.log('✅ Desktop agent service started');
  }

  /**
   * Stop the desktop agent service
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Desktop agent service stopped');
  }

  /**
   * Poll backend for pending commands
   */
  private async pollForCommands() {
    if (!this.authToken) {
      return;
    }

    try {
      const response = await axios.get(`${this.apiUrl}/api/desktop-agent/poll`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      const { commands } = response.data;

      if (commands && commands.length > 0) {
        console.log(`📥 Received ${commands.length} command(s) from mobile`);
        
        for (const command of commands) {
          await this.executeCommand(command);
        }
      }
    } catch (error) {
      // Silently fail - don't spam console
      if (axios.isAxiosError(error) && error.response?.status !== 401) {
        console.error('❌ Error polling for commands:', error.message);
      }
    }
  }

  /**
   * Execute a command and report result
   */
  private async executeCommand(command: any) {
    console.log('⚡ Executing command:', command.action);

    try {
      const result = await desktopAgent.executeAction(command.action);
      
      console.log(result.success ? '✅ Command succeeded' : '❌ Command failed', result);

      // Report result back to backend
      await this.reportResult(command.id, result);
    } catch (error) {
      console.error('❌ Command execution error:', error);
      
      await this.reportResult(command.id, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Report command result to backend
   */
  private async reportResult(commandId: string, result: CommandResult) {
    if (!this.authToken) {
      return;
    }

    try {
      await axios.post(
        `${this.apiUrl}/api/desktop-agent/result`,
        {
          commandId,
          ...result
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );
    } catch (error) {
      console.error('❌ Error reporting result:', error);
    }
  }

  /**
   * Execute a command directly (for testing)
   */
  async executeDirectCommand(action: CommandAction): Promise<CommandResult> {
    return await desktopAgent.executeAction(action);
  }

  /**
   * Parse natural language and execute
   */
  async executeNaturalLanguage(command: string): Promise<CommandResult> {
    const action = desktopAgent.parseNaturalLanguage(command);
    
    if (!action) {
      return {
        success: false,
        error: 'Could not understand command'
      };
    }

    return await desktopAgent.executeAction(action);
  }
}

export const agentService = new DesktopAgentService();
