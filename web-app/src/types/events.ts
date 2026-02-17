export enum SystemEvent {
  MCP_UPDATE = 'mcp-update',
  KILL_SIDECAR = 'kill-sidecar',
  MCP_ERROR = 'mcp-error',
  DEEP_LINK = 'deep-link',
  MCP_Elicitation = 'mcp-elicitation',
}

/**
 * Elicitation request from an MCP server
 */
export interface ElicitationRequest {
  id: string
  server: string
  message: string
  requestedSchema: Record<string, unknown>
}

/**
 * User action in response to elicitation
 */
export type ElicitationAction = 'accept' | 'decline' | 'cancel'
