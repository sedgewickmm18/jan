export enum SystemEvent {
  MCP_UPDATE = 'mcp-update',
  KILL_SIDECAR = 'kill-sidecar',
  MCP_ERROR = 'mcp-error',
  DEEP_LINK = 'deep-link',
  MCP_Elicitation = 'mcp-elicitation',
}

// ============================================================================
// MCP Elicitation Schema Types
// ============================================================================

/**
 * Base schema properties common to all schema types
 */
export interface BaseSchema {
  title?: string
  description?: string
  default?: unknown
}

/**
 * String schema for elicitation
 */
export interface StringSchema extends BaseSchema {
  type: 'string'
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'uri' | 'date' | 'date-time' | 'password' | string
}

/**
 * Number/Integer schema for elicitation
 */
export interface NumberSchema extends BaseSchema {
  type: 'number' | 'integer'
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
}

/**
 * Boolean schema for elicitation
 */
export interface BooleanSchema extends BaseSchema {
  type: 'boolean'
}

/**
 * Single enum option for oneOf/anyOf
 */
export interface EnumOption {
  const: string | number | boolean
  title?: string
  description?: string
}

/**
 * Single-select enum schema using oneOf
 */
export interface EnumSchema extends BaseSchema {
  type: 'string' | 'number' | 'integer' | 'boolean'
  oneOf?: EnumOption[]
  enum?: (string | number | boolean)[]
}

/**
 * Multi-select enum schema (array with anyOf items)
 */
export interface MultiSelectEnumSchema extends BaseSchema {
  type: 'array'
  minItems?: number
  maxItems?: number
  items: {
    anyOf?: EnumOption[]
  }
}

/**
 * Object schema with properties (traditional format)
 */
export interface ObjectSchema extends BaseSchema {
  type: 'object'
  properties?: Record<string, ElicitationSchema>
  required?: string[]
}

/**
 * Raw schema for formats that don't match standard types
 * This handles schemas like {"enum": ["a", "b"]} without a type field
 * (used by FastMCP scalar elicitation with list response_type)
 */
export interface RawSchema extends BaseSchema {
  type?: never  // No type field
  enum?: (string | number | boolean)[]
  oneOf?: EnumOption[]
  anyOf?: EnumOption[]
  [key: string]: unknown
}

/**
 * Union type for all supported elicitation schemas
 */
export type ElicitationSchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | EnumSchema
  | MultiSelectEnumSchema
  | ObjectSchema
  | RawSchema

/**
 * Elicitation request from an MCP server
 */
export interface ElicitationRequest {
  id: string
  server: string
  message: string
  requestedSchema: ElicitationSchema
}

/**
 * User action in response to elicitation
 */
export type ElicitationAction = 'accept' | 'decline' | 'cancel'
