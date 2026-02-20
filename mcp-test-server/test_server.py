#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fastmcp>=0.1.0"]
# ///
"""
MCP Test Server - Tests elicitation and sampling capabilities

This server provides tools to test:
1. Elicitation - requesting user input via forms
2. Sampling - requesting LLM completions

Run with: uvx test_server.py
"""

from dataclasses import dataclass
from typing import Annotated
from fastmcp import FastMCP, Context
from mcp.types import SamplingMessage, ModelPreferences, ModelHint

# Create the MCP server
mcp = FastMCP("MCP Test Server")


# ============================================================================
# Elicitation Schemas (using dataclasses for structured responses)
# ============================================================================

@dataclass
class NameResponse:
    """Simple name response schema"""
    name: str


@dataclass
class PreferencesForm:
    """Complex form with multiple field types"""
    favorite_color: Annotated[str, "Your favorite color"]
    age: Annotated[int, "Your age"]
    likes_mcp: Annotated[bool, "Do you like MCP?"]
    comments: Annotated[str, "Any additional comments (optional)"] = ""


@dataclass
class TopicRequest:
    """Topic selection for combined flow"""
    topic: Annotated[str, "The topic to explain"]
    detail_level: Annotated[str, "How detailed: brief, moderate, or detailed"] = "moderate"


# ============================================================================
# Elicitation Test Tools
# ============================================================================

@mcp.tool()
async def test_elicitation_simple(ctx: Context) -> str:
    """
    Test simple elicitation - asks user for their name.
    Returns the greeting with the provided name.
    """
    result = await ctx.elicit(
        message="What is your name?",
        response_type=NameResponse,
    )
    
    if result.action == "accept":
        return f"Hello, {result.data.name}! Nice to meet you."
    elif result.action == "decline":
        return "User declined to provide their name."
    else:
        return "User cancelled the elicitation request."


@mcp.tool()
async def test_elicitation_form(ctx: Context) -> str:
    """
    Test complex elicitation with multiple fields.
    Returns a summary of the provided information.
    """
    result = await ctx.elicit(
        message="Please fill out this form with your preferences:",
        response_type=PreferencesForm,
    )
    
    if result.action == "accept":
        data = result.data
        summary = f"User profile:\n"
        summary += f"- Favorite color: {data.favorite_color}\n"
        summary += f"- Age: {data.age}\n"
        summary += f"- Likes MCP: {'Yes!' if data.likes_mcp else 'No :('}\n"
        if data.comments:
            summary += f"- Comments: {data.comments}"
        return summary
    elif result.action == "decline":
        return "User declined to fill out the form."
    else:
        return "User cancelled the form."


@mcp.tool()
async def test_elicitation_primitive(ctx: Context) -> str:
    """
    Test elicitation with a primitive type (string).
    FastMCP wraps it in a 'value' field automatically.
    """
    result = await ctx.elicit(
        message="What is your favorite programming language?",
        response_type=str,
    )
    
    if result.action == "accept":
        return f"Nice! {result.data} is a great language!"
    elif result.action == "decline":
        return "User declined to answer."
    else:
        return "User cancelled."


@mcp.tool()
async def test_elicitation_enum(ctx: Context) -> str:
    """
    Test elicitation with enum choices (list of strings).
    """
    result = await ctx.elicit(
        message="Pick your favorite color:",
        response_type=["red", "green", "blue", "yellow", "purple", "orange"],
    )
    
    if result.action == "accept":
        return f"You chose: {result.data}"
    elif result.action == "decline":
        return "User declined to choose."
    else:
        return "User cancelled."


# ============================================================================
# Sampling Test Tools
# ============================================================================

@mcp.tool()
async def test_sampling_simple(ctx: Context) -> str:
    """
    Test simple sampling - asks LLM to write a haiku.
    Returns the generated haiku.
    """
    result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content={"type": "text", "text": "Write a haiku about programming."},
            )
        ],
        max_tokens=100,
        system_prompt="You are a creative poet. Write only the haiku, do not return anything else.",
    )
    
    # Extract text from the response
    content = result.content
    print("CONTENT", result)
    if content.type == "text":
        haiku = content.text
    else:
        haiku = f"[Received {content.type} content]"
    
    return f"Generated haiku:\n{haiku}\n\n(Model: {result.model})"


@mcp.tool()
async def test_sampling_conversation(ctx: Context) -> str:
    """
    Test sampling with a multi-turn conversation.
    Returns the LLM's response after context.
    """
    result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content={"type": "text", "text": "My favorite programming language is Python."},
            ),
            SamplingMessage(
                role="assistant", 
                content={"type": "text", "text": "That's great! Python is known for its readability and versatility. What do you use it for?"},
            ),
            SamplingMessage(
                role="user",
                content={"type": "text", "text": "I use it for data science and machine learning."},
            ),
        ],
        max_tokens=200,
        system_prompt="You are a friendly programming assistant. Continue the conversation naturally.",
    )
    
    content = result.content
    if content.type == "text":
        response = content.text
    else:
        response = f"[Received {content.type} content]"
    
    return f"LLM response:\n{response}\n\n(Model: {result.model})"


@mcp.tool()
async def test_sampling_with_preferences(ctx: Context) -> str:
    """
    Test sampling with model preferences (cost/speed/intelligence).
    Returns the generated content with model info.
    """
    result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content={"type": "text", "text": "Explain quantum computing in one sentence."},
            )
        ],
        max_tokens=150,
        system_prompt="You are a concise explainer. Answer briefly and accurately.",
        model_preferences=ModelPreferences(
            hints=[ModelHint(name="claude")],
            intelligence_priority=0.8,  # Prefer smarter models
            speed_priority=0.3,
            cost_priority=0.3,
        ),
    )
    
    content = result.content
    if content.type == "text":
        response = content.text
    else:
        response = f"[Received {content.type} content]"
    
    return f"Response:\n{response}\n\n(Model: {result.model}, Stop reason: {result.stop_reason})"


# ============================================================================
# Combined Elicitation + Sampling Tool
# ============================================================================

@mcp.tool()
async def test_combined_flow(ctx: Context) -> str:
    """
    Test a combined flow: elicit user preferences, then use sampling.
    Demonstrates the full MCP client capability pipeline.
    """
    # Step 1: Elicit user preferences
    result = await ctx.elicit(
        message="What topic would you like the LLM to explain?",
        response_type=TopicRequest,
    )
    
    if result.action != "accept":
        return "User cancelled the request."
    
    topic = result.data.topic
    detail_level = result.data.detail_level
    
    # Step 2: Use sampling to generate the explanation
    max_tokens_map = {"brief": 50, "moderate": 150, "detailed": 400}
    
    sampling_result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content={
                    "type": "text",
                    "text": f"Explain {topic} in a {detail_level} way.",
                },
            )
        ],
        max_tokens=max_tokens_map.get(detail_level, 150),
        system_prompt="You are a helpful educator. Provide clear, accurate explanations.",
    )
    
    content = sampling_result.content
    if content.type == "text":
        explanation = content.text
    else:
        explanation = f"[Received {content.type} content]"
    
    return (
        f"Topic: {topic}\n"
        f"Detail level: {detail_level}\n\n"
        f"Explanation:\n{explanation}\n\n"
        f"(Model: {sampling_result.model})"
    )


# ============================================================================
# Server Info
# ============================================================================

@mcp.resource("info://server")
async def server_info() -> str:
    """Information about this test server."""
    return """
# MCP Test Server

This server tests MCP client capabilities:

## Elicitation Tools
- `test_elicitation_simple`: Simple name request (dataclass)
- `test_elicitation_form`: Complex form with multiple fields
- `test_elicitation_primitive`: Primitive string type
- `test_elicitation_enum`: Enum selection from list

## Sampling Tools
- `test_sampling_simple`: Request a haiku
- `test_sampling_conversation`: Multi-turn conversation
- `test_sampling_with_preferences`: Sampling with model preferences

## Combined Tools
- `test_combined_flow`: Elicit preferences, then sample

## Usage
Call any of the tools above to test the corresponding MCP capability.
"""


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="MCP Test Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http", "sse", "streamable-http"],
        default="stdio",
        help="Transport protocol to use (default: stdio)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to for HTTP transports (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to for HTTP transports (default: 8000)",
    )
    
    args = parser.parse_args()
    
    # Run the server with specified transport
    if args.transport in ["http", "sse", "streamable-http"]:
        mcp.run(transport=args.transport, host=args.host, port=args.port)
    else:
        mcp.run()
