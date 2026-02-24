use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::oneshot;

// ============================================================================
// MCP Elicitation Schema Types
// ============================================================================

/// Base schema properties common to all schema types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseSchema {
    /// Human-readable title for the field
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Description of what the field is for
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Default value for the field
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,
}

/// String schema for elicitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StringSchema {
    #[serde(rename = "type")]
    pub type_: String, // Always "string"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    /// Minimum string length
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<u32>,
    /// Maximum string length
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<u32>,
    /// Regex pattern for validation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    /// Format hint (e.g., "email", "uri", "date")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

/// Number/Integer schema for elicitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberSchema {
    #[serde(rename = "type")]
    pub type_: String, // "number" or "integer"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<f64>,
    /// Minimum value (inclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimum: Option<f64>,
    /// Maximum value (inclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maximum: Option<f64>,
    /// Minimum value (exclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclusive_minimum: Option<f64>,
    /// Maximum value (exclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclusive_maximum: Option<f64>,
    /// Value must be a multiple of this number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multiple_of: Option<f64>,
}

/// Boolean schema for elicitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BooleanSchema {
    #[serde(rename = "type")]
    pub type_: String, // Always "boolean"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<bool>,
}

/// Single enum option for oneOf/anyOf
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumOption {
    /// The constant value for this option
    #[serde(rename = "const")]
    pub const_value: Value,
    /// Human-readable title for this option
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Description of this option
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Single-select enum schema using oneOf
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumSchema {
    #[serde(rename = "type")]
    pub type_: String, // "string", "number", "integer", or "boolean"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,
    /// Options using oneOf format (preferred)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub one_of: Option<Vec<EnumOption>>,
    /// Simple enum values
    #[serde(skip_serializing_if = "Option::is_none", rename = "enum")]
    pub enum_values: Option<Vec<Value>>,
}

/// Multi-select enum schema (array with anyOf items)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiSelectEnumSchema {
    #[serde(rename = "type")]
    pub type_: String, // Always "array"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<Vec<Value>>,
    /// Minimum number of items to select
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_items: Option<u32>,
    /// Maximum number of items to select
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_items: Option<u32>,
    /// The items schema containing anyOf options
    pub items: MultiSelectItems,
}

/// Items schema for multi-select
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiSelectItems {
    /// The available options using anyOf format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub any_of: Option<Vec<EnumOption>>,
}

/// Property schema for object properties
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PropertySchema {
    String(StringSchema),
    Number(NumberSchema),
    Boolean(BooleanSchema),
    Enum(EnumSchema),
    MultiSelect(MultiSelectEnumSchema),
    /// Raw JSON schema for unsupported types
    Raw(Value),
}

/// Object schema with properties (traditional format)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectSchema {
    #[serde(rename = "type")]
    pub type_: String, // Always "object"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Map of property name to schema
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Map<String, Value>>,
    /// List of required property names
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
}

/// Union type for all supported elicitation schemas
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ElicitSchema {
    String(StringSchema),
    Number(NumberSchema),
    Boolean(BooleanSchema),
    Enum(EnumSchema),
    MultiSelect(MultiSelectEnumSchema),
    Object(ObjectSchema),
    /// Raw JSON schema for unsupported types
    Raw(Value),
}

/// Elicitation request from an MCP server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElicitRequest {
    /// Unique ID for this elicitation request
    pub id: String,
    /// The server name that initiated the request
    pub server: String,
    /// The message to display to the user
    pub message: String,
    /// The JSON schema describing the expected response
    pub requested_schema: ElicitSchema,
}

/// Response to an elicitation request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElicitResponse {
    /// The action taken by the user
    pub action: ElicitAction,
    /// The content submitted by the user (only present when action is "accept")
    pub content: Option<Value>,
}

/// User action in response to elicitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ElicitAction {
    /// User submitted the form/confirmed the action
    Accept,
    /// User explicitly declined the action
    Decline,
    /// User dismissed without making an explicit choice
    Cancel,
}

/// Pending elicitation request with response channel
pub struct PendingElicitation {
    pub request: ElicitRequest,
    pub response_tx: oneshot::Sender<ElicitResponse>,
}

// ============================================================================
// MCP Sampling Support
// ============================================================================

/// Sampling request from an MCP server (createMessage)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplingRequest {
    /// Unique ID for this sampling request
    pub id: String,
    /// The server name that initiated the request
    pub server: String,
    /// Messages in the conversation
    pub messages: Vec<SamplingMessage>,
    /// System prompt to use (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    /// Maximum tokens to generate
    pub max_tokens: u32,
    /// Temperature for sampling (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    /// Stop sequences (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
    /// Model preferences (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_preferences: Option<ModelPreferences>,
    /// Include context setting (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_context: Option<String>,
    /// Additional metadata (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

/// A message in a sampling conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplingMessage {
    /// The role of the message sender
    pub role: String,
    /// The content of the message
    pub content: SamplingContent,
}

/// Content of a sampling message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SamplingContent {
    Text { text: String },
    Image { data: String, mime_type: String },
    Resource { resource: ResourceContent },
}

/// Resource content for sampling messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceContent {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// Model preferences for sampling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPreferences {
    /// Hints for model selection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hints: Option<Vec<ModelHint>>,
    /// Priority for cost efficiency (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_priority: Option<f64>,
    /// Priority for speed (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed_priority: Option<f64>,
    /// Priority for intelligence (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intelligence_priority: Option<f64>,
}

/// A hint for model selection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Response to a sampling request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplingResponse {
    /// The generated message
    pub message: SamplingMessage,
    /// The model that was used
    pub model: String,
    /// Reason for stopping
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
}

/// User action in response to sampling request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SamplingAction {
    /// User accepted/provided a response
    Accept,
    /// User declined to generate
    Decline,
    /// User cancelled the request
    Cancel,
}

/// Pending sampling request with response channel
pub struct PendingSampling {
    pub request: SamplingRequest,
    pub response_tx: oneshot::Sender<Result<SamplingResponse, SamplingAction>>,
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

/// Configuration parameters extracted from MCP server config
#[derive(Debug, Clone)]
pub struct McpServerConfig {
    pub transport_type: Option<String>,
    pub url: Option<String>,
    pub command: String,
    pub args: Vec<Value>,
    pub envs: serde_json::Map<String, Value>,
    pub timeout: Option<Duration>,
    pub headers: serde_json::Map<String, Value>,
}

fn default_tool_call_timeout_seconds() -> u64 {
    super::constants::DEFAULT_MCP_TOOL_CALL_TIMEOUT_SECS
}

fn default_base_restart_delay_ms() -> u64 {
    super::constants::DEFAULT_MCP_BASE_RESTART_DELAY_MS
}

fn default_max_restart_delay_ms() -> u64 {
    super::constants::DEFAULT_MCP_MAX_RESTART_DELAY_MS
}

fn default_backoff_multiplier() -> f64 {
    super::constants::DEFAULT_MCP_BACKOFF_MULTIPLIER
}

/// Runtime MCP settings that can be adjusted via UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSettings {
    #[serde(default = "default_tool_call_timeout_seconds")]
    pub tool_call_timeout_seconds: u64,
    #[serde(default = "default_base_restart_delay_ms")]
    pub base_restart_delay_ms: u64,
    #[serde(default = "default_max_restart_delay_ms")]
    pub max_restart_delay_ms: u64,
    #[serde(default = "default_backoff_multiplier")]
    pub backoff_multiplier: f64,
}

impl Default for McpSettings {
    fn default() -> Self {
        Self {
            tool_call_timeout_seconds: super::constants::DEFAULT_MCP_TOOL_CALL_TIMEOUT_SECS,
            base_restart_delay_ms: super::constants::DEFAULT_MCP_BASE_RESTART_DELAY_MS,
            max_restart_delay_ms: super::constants::DEFAULT_MCP_MAX_RESTART_DELAY_MS,
            backoff_multiplier: super::constants::DEFAULT_MCP_BACKOFF_MULTIPLIER,
        }
    }
}

impl McpSettings {
    /// Returns the tool call timeout duration, enforcing a minimum of 1 second to avoid zero-duration timeouts.
    pub fn tool_call_timeout_duration(&self) -> std::time::Duration {
        std::time::Duration::from_secs(self.tool_call_timeout_seconds.max(1))
    }
}

/// Tool with server information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolWithServer {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: serde_json::Value,
    pub server: String,
}