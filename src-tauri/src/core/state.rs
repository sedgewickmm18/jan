use std::{collections::HashMap, sync::Arc};

use crate::core::{downloads::models::DownloadManagerState, mcp::models::{McpSettings, PendingElicitation, PendingSampling}};
use rmcp::{
    model::{CallToolRequestParam, CallToolResult, InitializeRequestParam, Tool},
    service::RunningService,
    RoleClient, ServiceError,
};
use tokio::sync::{oneshot, Mutex};

use super::mcp::helpers::JanClientHandler;

/// Server handle type for managing the proxy server lifecycle
pub type ServerHandle =
    tauri::async_runtime::JoinHandle<Result<(), Box<dyn std::error::Error + Send + Sync>>>;

/// Provider configuration for remote model providers
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ProviderConfig {
    pub provider: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub custom_headers: Vec<ProviderCustomHeader>,
    pub models: Vec<String>,
    /// Whether this provider is active/enabled
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ProviderCustomHeader {
    pub header: String,
    pub value: String,
}

/// Type alias for the elicitation running service
pub type ElicitationService = RunningService<RoleClient, JanClientHandler>;

pub enum RunningServiceEnum {
    NoInit(RunningService<RoleClient, ()>),
    WithInit(RunningService<RoleClient, InitializeRequestParam>),
    /// HTTP client with custom elicitation handler
    WithElicitation(ElicitationService),
}
pub type SharedMcpServers = Arc<Mutex<HashMap<String, RunningServiceEnum>>>;

#[derive(Default)]
pub struct AppState {
    pub app_token: Option<String>,
    pub mcp_servers: SharedMcpServers,
    pub download_manager: Arc<Mutex<DownloadManagerState>>,
    pub mcp_active_servers: Arc<Mutex<HashMap<String, serde_json::Value>>>,
    pub server_handle: Arc<Mutex<Option<ServerHandle>>>,
    pub tool_call_cancellations: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    pub mcp_settings: Arc<Mutex<McpSettings>>,
    pub mcp_shutdown_in_progress: Arc<Mutex<bool>>,
    pub mcp_monitoring_tasks: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
    pub background_cleanup_handle: Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
    pub mcp_server_pids: Arc<Mutex<HashMap<String, u32>>>,
    /// Remote provider configurations (e.g., Anthropic, OpenAI, etc.)
    pub provider_configs: Arc<Mutex<HashMap<String, ProviderConfig>>>,
    /// Pending elicitation requests waiting for user response
    pub pending_elicitations: Arc<Mutex<HashMap<String, PendingElicitation>>>,
    /// Pending sampling requests waiting for LLM response
    pub pending_samplings: Arc<Mutex<HashMap<String, PendingSampling>>>,
    /// Track which MCP servers have successfully connected (for restart policy)
    pub mcp_successfully_connected: Arc<Mutex<HashMap<String, bool>>>,
    /// The port the proxy server is running on (set by start_server command)
    pub proxy_port: Arc<Mutex<Option<u16>>>,
    /// The currently active model ID for sampling requests
    pub active_model: Arc<Mutex<Option<String>>>,
}

impl RunningServiceEnum {
    pub async fn list_all_tools(&self) -> Result<Vec<Tool>, ServiceError> {
        match self {
            Self::NoInit(s) => s.list_all_tools().await,
            Self::WithInit(s) => s.list_all_tools().await,
            Self::WithElicitation(s) => s.list_all_tools().await,
        }
    }
    pub async fn call_tool(
        &self,
        params: CallToolRequestParam,
    ) -> Result<CallToolResult, ServiceError> {
        match self {
            Self::NoInit(s) => s.call_tool(params).await,
            Self::WithInit(s) => s.call_tool(params).await,
            Self::WithElicitation(s) => s.call_tool(params).await,
        }
    }
}