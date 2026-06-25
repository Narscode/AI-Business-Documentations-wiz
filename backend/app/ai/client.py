"""Anthropic client wrapper with tool-use JSON extraction and retries.

The AI layer never returns free-form text where structured data is needed —
every call uses tool-use so Claude is forced to return validated JSON.
"""

from __future__ import annotations

import logging
from typing import Any

import anthropic
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..config import settings

logger = logging.getLogger("kvp.ai")

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        kwargs = {"api_key": settings.ANTHROPIC_API_KEY}
        if settings.ANTHROPIC_BASE_URL:
            kwargs["base_url"] = settings.ANTHROPIC_BASE_URL
        _client = anthropic.Anthropic(**kwargs)
    return _client


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(
        (anthropic.APIConnectionError, anthropic.RateLimitError, anthropic.InternalServerError)
    ),
)
def call_tool(
    *,
    model: str,
    system: str | list[dict],
    user_content: str | list[dict],
    tool_name: str,
    tool_schema: dict,
    max_tokens: int = 8000,
) -> dict[str, Any]:
    """Make a Claude call that forces tool use to return structured JSON.

    Returns the parsed `input` dict from the tool_use block.
    """
    client = get_client()
    messages = (
        [{"role": "user", "content": user_content}]
        if isinstance(user_content, str)
        else [{"role": "user", "content": user_content}]
    )

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        tools=[
            {
                "name": tool_name,
                "description": f"Return structured output for {tool_name}.",
                "input_schema": tool_schema,
            }
        ],
        tool_choice={"type": "tool", "name": tool_name},
        messages=messages,
    )

    usage = response.usage
    logger.info(
        "claude.call model=%s tool=%s in=%d out=%d cache_read=%d cache_write=%d",
        model,
        tool_name,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_read_input_tokens", 0) or 0,
        getattr(usage, "cache_creation_input_tokens", 0) or 0,
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input  # type: ignore[return-value]

    raise RuntimeError(f"Claude did not return a tool_use block for {tool_name}")
