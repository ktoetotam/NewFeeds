"""
llm_client.py — Shared LLM client for the NewFeeds pipeline.

Supports both:
  - OpenAI-compatible endpoints (llama.cpp, vLLM, etc.)
  - Legacy MiniMax API (auto-detected via base_resp field)

Configuration via environment variables:
  LLM_API_URL   — Chat completions endpoint (default: MiniMax)
  LLM_API_KEY   — Bearer token (falls back to MINIMAX_API_KEY)
  LLM_MODEL     — Model name (default: MiniMax-M2.5)
"""

import json
import logging
import os
import re
import time

import requests

logger = logging.getLogger(__name__)

# ── Defaults ──
_DEFAULT_API_URL = ""  # Must be set via LLM_API_URL
_DEFAULT_MODEL = ""    # Must be set via LLM_MODEL

# Regex to strip <think>…</think> blocks from reasoning-mode responses
_THINK_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)


def get_api_url() -> str:
    url = os.environ.get("LLM_API_URL", "")
    if not url:
        raise ValueError("LLM_API_URL environment variable not set")
    return url


def get_api_key() -> str:
    """Get LLM API key from environment."""
    key = os.environ.get("LLM_API_KEY", "")
    if not key:
        raise ValueError("LLM_API_KEY environment variable not set")
    return key


def get_model() -> str:
    model = os.environ.get("LLM_MODEL", "")
    if not model:
        raise ValueError("LLM_MODEL environment variable not set")
    return model


def _is_local_endpoint() -> bool:
    """Check if the LLM endpoint is a local/self-hosted server."""
    url = get_api_url()
    return "minimax" not in url


def call_llm(
    prompt: str,
    system_prompt: str,
    api_key: str,
    *,
    temperature: float = 0.1,
    max_tokens: int = 600,
    timeout: int = 60,
    max_retries: int = 5,
    retry_delay: int = 5,
    reasoning: bool = False,
    thinking_budget: int = -1,
) -> str:
    """
    Call an LLM chat-completion endpoint.

    Handles both OpenAI-compatible and MiniMax response formats.
    When reasoning=True, enables thinking mode (llama.cpp) for deeper analysis.
    Returns the assistant's response text (empty string on failure).
    """
    api_url = get_api_url()
    model = get_model()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Per-request reasoning control for llama.cpp endpoints
    if _is_local_endpoint():
        payload["chat_template_kwargs"] = {"enable_thinking": reasoning}
        if reasoning and thinking_budget >= 0:
            payload["thinking_budget_tokens"] = thinking_budget

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                api_url, headers=headers, json=payload, timeout=timeout
            )

            if resp.status_code == 429:
                wait = retry_delay * (2 ** attempt)
                logger.warning(f"Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            # Extract content
            choices = data.get("choices", [])
            if choices:
                text = choices[0].get("message", {}).get("content", "")
                # Strip <think>…</think> blocks from reasoning-mode responses
                text = _THINK_RE.sub("", text)
                # Also strip an unclosed <think> block (truncated reasoning)
                text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
                return text.strip()

            logger.warning(f"Unexpected API response format: {data}")
            return ""

        except requests.exceptions.Timeout:
            logger.warning(f"Timeout on attempt {attempt + 1}")
            time.sleep(retry_delay)
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (2 ** attempt))

    return ""


def call_llm_json(
    prompt: str,
    system_prompt: str,
    api_key: str,
    *,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    timeout: int = 120,
    max_retries: int = 5,
    retry_delay: int = 5,
    reasoning: bool = False,
    thinking_budget: int = -1,
) -> dict | None:
    """
    Call LLM and parse the response as JSON.

    Handles markdown fences, truncated JSON, and retries.
    When reasoning=True, enables thinking mode for deeper analysis.
    When thinking_budget >= 0, caps reasoning tokens (llama.cpp thinking_budget_tokens).
    Returns parsed dict or None on failure.
    """
    api_url = get_api_url()
    model = get_model()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Per-request reasoning control for llama.cpp endpoints
    if _is_local_endpoint():
        payload["chat_template_kwargs"] = {"enable_thinking": reasoning}
        if reasoning and thinking_budget >= 0:
            payload["thinking_budget_tokens"] = thinking_budget

    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.post(
                api_url, headers=headers, json=payload, timeout=timeout
            )

            if resp.status_code == 429:
                wait = retry_delay * attempt
                logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt})")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            choices = data.get("choices", [])
            if not choices:
                logger.warning("Empty choices in LLM response")
                return None

            choice = choices[0]
            finish_reason = choice.get("finish_reason", "")
            text = choice.get("message", {}).get("content", "").strip()

            # Strip <think>…</think> blocks from reasoning-mode responses
            text = _THINK_RE.sub("", text)
            # Also strip an unclosed <think> block (truncated reasoning)
            text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
            text = text.strip()

            if finish_reason == "length":
                logger.warning(
                    f"Response truncated (finish_reason=length) on attempt {attempt}"
                )

            # Strip markdown code fences
            if text.startswith("```"):
                text = text.split("\n", 1)[-1]
                text = text.rsplit("```", 1)[0].strip()

            # Try direct parse
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                # Try to extract first JSON object
                m = re.search(r"\{.*\}", text, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except json.JSONDecodeError:
                        pass
                logger.warning(
                    f"JSON parse error on attempt {attempt}: {text[:200]!r}"
                )
                if attempt < max_retries:
                    time.sleep(retry_delay)

        except requests.RequestException as e:
            logger.warning(f"API request error on attempt {attempt}: {e}")
            if attempt < max_retries:
                time.sleep(retry_delay)

    logger.error("All LLM attempts failed")
    return None
