# MCP Test Server

A FastMCP-based test server for testing MCP client elicitation and sampling capabilities.

## Features

This server provides tools to test:

### Elicitation Tools
- **`test_elicitation_simple`** - Simple name request (dataclass)
- **`test_elicitation_form`** - Complex form with multiple fields
- **`test_elicitation_primitive`** - Primitive string type
- **`test_elicitation_enum`** - Enum selection from list

### Sampling Tools
- **`test_sampling_simple`** - Requests a haiku from the LLM
- **`test_sampling_conversation`** - Multi-turn conversation test
- **`test_sampling_with_preferences`** - Sampling with model preferences

**Note**: Sampling uses the Local API server as Proxy. Make sure it is started with an empty API key.

### Combined Tools
- **`test_combined_flow`** - Elicits user preferences, then uses sampling

## Running

The script uses inline script metadata (PEP 723), so dependencies are automatically installed.

### HTTP Transports

For remote access, use streamable HTTP:

```bash
# Streamable HTTP (recommended for MCP)
uv run test_server.py --transport streamable-http --host 0.0.0.0 --port 8000

# SSE transport
uv run test_server.py --transport sse --host 0.0.0.0 --port 8000

# HTTP transport
uv run test_server.py --transport http --host 0.0.0.0 --port 8000
```

### Stdio Transport (default)

**Caveat**: Currently Jan.ai only supports elicition and sampling over streamable http.

```bash
cd mcp-test-server
uv run test_server.py
```


Options:
- `--transport`: `stdio`, `http`, `sse`, or `streamable-http` (default: stdio)
- `--host`: Host to bind (default: 127.0.0.1, use 0.0.0.0 for all interfaces)
- `--port`: Port to bind (default: 8000)

## Configuring in Jan

### Remote (streamable-http)

```json
{
  "mcpServers": {
    "MCP Test Server": {
      "type": "http",
      "url": "http://your-server:8000/mcp",
      "active": true
    }
  }
}
```

### Local (stdio)

```json
{
  "mcpServers": {
    "MCP Test Server": {
      "command": "uv",
      "args": ["run", "/path/to/jan/mcp-test-server/test_server.py"],
      "active": true
    }
  }
}
```

## Testing the Server

1. Start Jan with the server *and* the local API server configured. Make sure the MCP server runs remotely and
the Local API server is started with an empty API key.
2. The server should appear in your MCP servers list
3. Call any of the test tools:
   - `test_elicitation_simple` - Will show a dialog asking for your name
   - `test_sampling_simple` - Will request the LLM to write a haiku
   - `test_combined_flow` - Will first ask for a topic, then generate an explanation

## Expected Behavior

### Elicitation Tests
When you call an elicitation tool:
1. Jan should show a dialog with the requested form
2. You can fill it out and submit, decline, or cancel
3. The tool returns a result based on your action

### Sampling Tests
When you call a sampling tool:
1. Jan should send the request to the active LLM
2. The LLM generates a response
3. The tool returns the generated content with model info

### Combined Test
When you call `test_combined_flow`:
1. First, an elicitation dialog appears asking for a topic
2. After you submit, the LLM is asked to explain the topic
3. The tool returns both your input and the LLM's explanation
