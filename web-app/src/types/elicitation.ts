/**
 * Enhanced MCP Elicitation Schema Definitions
 * Based on rmcp 1.1.0 and MCP 2025-06-18 specification
 */

// Base schema types
export type BaseSchema = {
  title?: string;
  description?: string;
  default?: any;
};

// String schema with enhanced validation
export type StringSchema = BaseSchema & {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'uri' | 'date' | 'date-time';
};

// Number schema with enhanced validation
export type NumberSchema = BaseSchema & {
  type: 'number' | 'integer';
  minimum?: number;
  maximum?: number;
};

// Boolean schema
export type BooleanSchema = BaseSchema & {
  type: 'boolean';
  default?: boolean;
};

// Enum schema with options
export type EnumSchema = BaseSchema & {
  type: 'string';
  enum: string[];
  enumNames?: string[];
};

// Enhanced ElicitationSchema based on rmcp 1.1.0
export type ElicitationSchema = {
  type: 'object';
  title?: string;
  properties: Record<string, PrimitiveSchema>;
  required?: string[];
  description?: string;
};

// Primitive schema types
export type PrimitiveSchema = StringSchema | NumberSchema | BooleanSchema | EnumSchema;

// Enhanced MCP Tool schema with proper inputSchema typing
export type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, PrimitiveSchema>;
  server: string;
};

// Elicitation request/response types
export type ElicitationRequest = {
  tool: string;
  arguments?: Record<string, any>;
};

export type ElicitationResult = {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  is_error?: boolean;
};

// Enhanced ElicitationAction enum
export enum ElicitationAction {
  ACCEPT = 'accept',
  DECLINE = 'decline',
  CANCEL = 'cancel',
}