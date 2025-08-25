import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { type StructuredTool } from '@langchain/core/tools';

export class ActionSubsystem {
  private client: MultiServerMCPClient;
  private tools: StructuredTool[] = [];
  private isInitialized = false;

  constructor() {
    this.client = new MultiServerMCPClient({
      // For now, we'll connect to the "everything" server which runs locally.
      // This is great for development and testing.
      mcpServers: {
        local: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-everything'],
        },
      },
      // Prefixing is good practice if we add more servers later.
      prefixToolNameWithServerName: true,
    });
  }

  /**
   * Initializes the MCP client and loads tools from the configured servers.
   * This must be called before getTools() can be used.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('ActionSubsystem already initialized.');
      return;
    }
    console.log('Initializing ActionSubsystem and loading tools...');
    try {
      // The public method to get tools is getTools(), not loadTools().
      this.tools = await this.client.getTools();
      this.isInitialized = true;
      console.log(`Tools loaded successfully: ${this.tools.map(t => t.name).join(', ')}`);
    } catch (error) {
      console.error('Failed to initialize ActionSubsystem:', error);
      // In a real app, you might want to handle this more gracefully.
      throw error;
    }
  }

  /**
   * Returns the array of loaded LangChain tools.
   * Throws an error if the subsystem has not been initialized.
   */
  public getTools(): StructuredTool[] {
    if (!this.isInitialized) {
      throw new Error('ActionSubsystem is not initialized. Call initialize() first.');
    }
    return this.tools;
  }

  /**
   * Gracefully shuts down the MCP server connections.
   * Should be called when the application is closing.
   */
  public async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('ActionSubsystem cleaned up.');
    }
  }
}
