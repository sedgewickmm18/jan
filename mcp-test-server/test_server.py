#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fastmcp>=0.1.0"]
# ///
"""
MCP Test Server - Tests elicitation and sampling capabilities

This server provides tools to test:
1. Elicitation - requesting user input via forms with various schema types
2. Sampling - requesting LLM completions

Run with: uvx test_server.py
"""

from dataclasses import dataclass
from typing import Annotated, Literal
from pydantic import Field
from fastmcp import FastMCP, Context
from mcp.types import SamplingMessage, ModelPreferences, ModelHint

# Create the MCP server
mcp = FastMCP("MCP Test Server")


# ============================================================================
# Elicitation Schemas (using dataclasses and Pydantic for structured responses)
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
# String Schema Tests
# ============================================================================

@dataclass
class ValidatedStringResponse:
    """String with validation constraints"""
    username: str = Field(min_length=3, max_length=20)
    email: str = Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


@dataclass
class PasswordResponse:
    """Password with length constraints"""
    password: str = Field(min_length=8, max_length=64)


# ============================================================================
# Number Schema Tests
# ============================================================================

@dataclass
class AgeResponse:
    """Age with range validation"""
    age: int = Field(ge=0, le=150)


@dataclass
class PercentageResponse:
    """Percentage with min/max constraints"""
    percentage: float = Field(ge=0.0, le=100.0)


@dataclass
class RatingResponse:
    """Rating from 1 to 5"""
    rating: int = Field(ge=1, le=5)


# ============================================================================
# Enum Schema Tests
# ============================================================================

ColorChoice = Literal["red", "green", "blue", "yellow", "purple", "orange"]

PriorityLevel = Literal["low", "medium", "high", "critical"]


@dataclass
class ColorSelection:
    """Single color selection using enum"""
    color: ColorChoice


@dataclass  
class PrioritySelection:
    """Priority selection with enum"""
    priority: PriorityLevel
    reason: str = ""


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
# String Schema Test Tools
# ============================================================================

@mcp.tool()
async def test_string_validation(ctx: Context) -> str:
    """
    Test string schema with validation constraints.
    Username: 3-20 characters
    Email: Must match email pattern
    """
    result = await ctx.elicit(
        message="Please provide your username and email (validated fields):",
        response_type=ValidatedStringResponse,
    )
    
    if result.action == "accept":
        data = result.data
        return f"Validated input:\n- Username: {data.username} ({len(data.username)} chars)\n- Email: {data.email}"
    elif result.action == "decline":
        return "User declined to provide validated input."
    else:
        return "User cancelled."


@mcp.tool()
async def test_password_field(ctx: Context) -> str:
    """
    Test password field with length constraints.
    Password: 8-64 characters
    """
    result = await ctx.elicit(
        message="Please enter a password (8-64 characters):",
        response_type=PasswordResponse,
    )
    
    if result.action == "accept":
        password = result.data.password
        # Show length but not the actual password for security demo
        return f"Password accepted: {len(password)} characters (hidden for security)"
    elif result.action == "decline":
        return "User declined to provide password."
    else:
        return "User cancelled."


@mcp.tool()
async def test_string_with_format(ctx: Context) -> str:
    """
    Test string field requesting email format.
    """
    # Using a simple dataclass with email pattern
    result = await ctx.elicit(
        message="Please enter your email address:",
        response_type=Annotated[str, Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")],
    )
    
    if result.action == "accept":
        return f"Email accepted: {result.data}"
    elif result.action == "decline":
        return "User declined to provide email."
    else:
        return "User cancelled."


# ============================================================================
# Number Schema Test Tools
# ============================================================================

@mcp.tool()
async def test_number_range(ctx: Context) -> str:
    """
    Test number schema with range validation.
    Age: 0-150 (integer)
    """
    result = await ctx.elicit(
        message="Please enter your age (0-150):",
        response_type=AgeResponse,
    )
    
    if result.action == "accept":
        age = result.data.age
        category = "minor" if age < 18 else "adult" if age < 65 else "senior"
        return f"Age accepted: {age} (category: {category})"
    elif result.action == "decline":
        return "User declined to provide age."
    else:
        return "User cancelled."


@mcp.tool()
async def test_percentage(ctx: Context) -> str:
    """
    Test number schema with float range validation.
    Percentage: 0.0-100.0 (float)
    """
    result = await ctx.elicit(
        message="Please enter a percentage (0.0 - 100.0):",
        response_type=PercentageResponse,
    )
    
    if result.action == "accept":
        pct = result.data.percentage
        return f"Percentage accepted: {pct}%"
    elif result.action == "decline":
        return "User declined to provide percentage."
    else:
        return "User cancelled."


@mcp.tool()
async def test_rating(ctx: Context) -> str:
    """
    Test integer schema with constrained range.
    Rating: 1-5 (integer)
    """
    result = await ctx.elicit(
        message="Please rate your experience (1-5 stars):",
        response_type=RatingResponse,
    )
    
    if result.action == "accept":
        rating = result.data.rating
        stars = "⭐" * rating
        return f"Rating accepted: {rating} stars {stars}"
    elif result.action == "decline":
        return "User declined to rate."
    else:
        return "User cancelled."


# ============================================================================
# Enum Schema Test Tools
# ============================================================================

@mcp.tool()
async def test_enum_literal(ctx: Context) -> str:
    """
    Test enum selection using Literal type hint.
    """
    result = await ctx.elicit(
        message="Select your priority level:",
        response_type=PrioritySelection,
    )
    
    if result.action == "accept":
        data = result.data
        emoji = {"low": "🟢", "medium": "🟡", "high": "🟠", "critical": "🔴"}
        msg = f"Priority: {emoji.get(data.priority, '⚪')} {data.priority}"
        if data.reason:
            msg += f"\nReason: {data.reason}"
        return msg
    elif result.action == "decline":
        return "User declined to select priority."
    else:
        return "User cancelled."


@mcp.tool()
async def test_enum_oneof(ctx: Context) -> str:
    """
    Test enum selection with oneOf-style Literal.
    Select a color from predefined options.
    """
    result = await ctx.elicit(
        message="Choose your favorite color:",
        response_type=ColorSelection,
    )
    
    if result.action == "accept":
        color = result.data.color
        emoji = {"red": "🔴", "green": "🟢", "blue": "🔵", "yellow": "🟡", "purple": "🟣", "orange": "🟠"}
        return f"You chose: {emoji.get(color, '⚪')} {color}"
    elif result.action == "decline":
        return "User declined to choose."
    else:
        return "User cancelled."


# ============================================================================
# Multi-Select Test Tools (using list types)
# ============================================================================

@dataclass
class MultiColorSelection:
    """Multiple color selections"""
    colors: list[ColorChoice] = Field(min_length=1, max_length=3)


@dataclass
class FeatureSelection:
    """Select multiple features"""
    features: list[str] = Field(min_length=1, max_length=5)


@mcp.tool()
async def test_multiselect_colors(ctx: Context) -> str:
    """
    Test multi-select with list type.
    Select 1-3 colors from options.
    """
    result = await ctx.elicit(
        message="Select your favorite colors (1-3 choices):",
        response_type=MultiColorSelection,
    )
    
    if result.action == "accept":
        colors = result.data.colors
        emoji = {"red": "🔴", "green": "🟢", "blue": "🔵", "yellow": "🟡", "purple": "🟣", "orange": "🟠"}
        selected = [f"{emoji.get(c, '⚪')} {c}" for c in colors]
        return f"Selected colors ({len(colors)}):\n" + "\n".join(f"- {s}" for s in selected)
    elif result.action == "decline":
        return "User declined to select colors."
    else:
        return "User cancelled."


@mcp.tool()
async def test_multiselect_features(ctx: Context) -> str:
    """
    Test multi-select for feature selection.
    Select 1-5 features from a list.
    """
    # This will show as a list of strings to choose from
    result = await ctx.elicit(
        message="Select the features you'd like to enable (1-5 choices):",
        response_type=FeatureSelection,
    )
    
    if result.action == "accept":
        features = result.data.features
        return f"Enabled features ({len(features)}):\n" + "\n".join(f"✓ {f}" for f in features)
    elif result.action == "decline":
        return "User declined to select features."
    else:
        return "User cancelled."


# ============================================================================
# Comprehensive Form Test
# ============================================================================

@dataclass
class ComprehensiveForm:
    """Form testing all field types"""
    # String fields
    name: str = Field(min_length=2, max_length=50)
    email: str = Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    
    # Number fields
    age: int = Field(ge=0, le=150)
    
    # Boolean
    newsletter: bool = False
    
    # Enum
    color: ColorChoice = "blue"


@mcp.tool()
async def test_comprehensive_form(ctx: Context) -> str:
    """
    Test a comprehensive form with all field types:
    - String with validation
    - Email with pattern
    - Number with range
    - Boolean checkbox
    - Enum selection
    """
    result = await ctx.elicit(
        message="Please fill out this comprehensive registration form:",
        response_type=ComprehensiveForm,
    )
    
    if result.action == "accept":
        data = result.data
        summary = "Registration Summary:\n"
        summary += f"━━━━━━━━━━━━━━━━━━━━━\n"
        summary += f"👤 Name: {data.name}\n"
        summary += f"📧 Email: {data.email}\n"
        summary += f"🎂 Age: {data.age}\n"
        summary += f"🎨 Favorite Color: {data.color}\n"
        summary += f"📰 Newsletter: {'Yes' if data.newsletter else 'No'}\n"
        return summary
    elif result.action == "decline":
        return "User declined to fill out the form."
    else:
        return "User cancelled the form."


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

### Basic Tools
- `test_elicitation_simple`: Simple name request (dataclass)
- `test_elicitation_form`: Complex form with multiple fields
- `test_elicitation_primitive`: Primitive string type
- `test_elicitation_enum`: Enum selection from list

### String Schema Tests
- `test_string_validation`: Username (3-20 chars) + Email (pattern)
- `test_password_field`: Password with length constraints (8-64)
- `test_string_with_format`: Email format validation

### Number Schema Tests
- `test_number_range`: Age validation (0-150)
- `test_percentage`: Float percentage (0.0-100.0)
- `test_rating`: Integer rating (1-5)

### Enum Schema Tests
- `test_enum_literal`: Priority selection using Literal
- `test_enum_oneof`: Color selection with oneOf-style Literal

### Multi-Select Tests
- `test_multiselect_colors`: Select 1-3 colors
- `test_multiselect_features`: Select 1-5 features

### Comprehensive Test
- `test_comprehensive_form`: Form with all field types combined

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