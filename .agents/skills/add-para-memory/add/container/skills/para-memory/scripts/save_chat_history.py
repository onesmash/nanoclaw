#!/usr/bin/env python3
"""
SessionEnd hook: save the raw conversation to a per-session markdown file.

Inspired by:
  https://github.com/affaan-m/everything-claude-code/blob/main/scripts/hooks/session-end.js

Hook input (stdin): JSON with {"transcript_path": "..."}
Output: ${PARA_MEMORY_ROOT:-~/para-memory}/memory/sessions/YYYY-MM-DD-<shortId>-session.md
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_sessions_dir() -> Path:
    root = os.environ.get("PARA_MEMORY_ROOT", "~/para-memory")
    return Path(root).expanduser() / "memory"


def get_short_id(session_id: str) -> str:
    return session_id[:8] if session_id else "unknown"


# ---------------------------------------------------------------------------
# Transcript parsing
# ---------------------------------------------------------------------------

def extract_text(content) -> str:
    """Return plain text from a message content field (str or list of blocks)."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [
            b.get("text", "").strip()
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        return "\n\n".join(p for p in parts if p)
    return ""


def parse_transcript(transcript_path: str) -> tuple[list[dict], dict]:
    """
    Parse a Claude Code JSONL transcript.

    Returns:
        messages: [{"role": "user"|"assistant", "text": str}, ...]
        meta:     {"session_id": str, "slug": str, "cwd": str,
                   "tools_used": list[str], "files_modified": list[str]}
    """
    messages: list[dict] = []
    meta = {"session_id": "", "slug": "", "cwd": "", "tools_used": [], "files_modified": []}
    tools_used: set[str] = set()
    files_modified: set[str] = set()
    parse_errors = 0

    for line in Path(transcript_path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            parse_errors += 1
            continue

        if not meta["session_id"] and entry.get("sessionId"):
            meta["session_id"] = entry["sessionId"]
        if not meta["slug"] and entry.get("slug"):
            meta["slug"] = entry["slug"]
        if not meta["cwd"] and entry.get("cwd"):
            meta["cwd"] = entry["cwd"]

        entry_type = entry.get("type", "")

        # User messages (skip isMeta entries)
        if entry_type == "user" and not entry.get("isMeta"):
            raw = entry.get("message", {}).get("content") or entry.get("content", "")
            text = extract_text(raw)
            if text:
                messages.append({"role": "user", "text": text})

        # Assistant messages — merge consecutive streaming updates;
        # also collect tool_use blocks
        elif entry_type == "assistant":
            content = entry.get("message", {}).get("content", [])
            text = extract_text(content)
            if text:
                if messages and messages[-1]["role"] == "assistant":
                    messages[-1]["text"] = text  # replace with latest (most complete)
                else:
                    messages.append({"role": "assistant", "text": text})
            if isinstance(content, list):
                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    tool_name = block.get("name") or ""
                    if tool_name:
                        tools_used.add(tool_name)
                    file_path = block.get("input", {}).get("file_path") or ""
                    if file_path and tool_name in ("Edit", "Write"):
                        files_modified.add(file_path)

        # Direct tool_use entries
        elif entry_type == "tool_use" or entry.get("tool_name"):
            tool_name = entry.get("tool_name") or entry.get("name") or ""
            if tool_name:
                tools_used.add(tool_name)
            file_path = (
                entry.get("tool_input", {}).get("file_path")
                or entry.get("input", {}).get("file_path")
                or ""
            )
            if file_path and tool_name in ("Edit", "Write"):
                files_modified.add(file_path)

    if parse_errors:
        print(f"[SessionEnd] Skipped {parse_errors} unparseable lines", file=sys.stderr)

    meta["tools_used"] = sorted(tools_used)
    meta["files_modified"] = sorted(files_modified)
    return messages, meta


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def build_conversation(messages: list[dict]) -> str:
    lines = []
    for msg in messages:
        label = "**User**" if msg["role"] == "user" else "**Assistant**"
        lines.append(f"{label}: {msg['text']}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Session file management  (mirrors the JS reference)
# ---------------------------------------------------------------------------

def run(transcript_path: str) -> None:
    p = Path(transcript_path)

    # .txt files: copy content directly
    if p.suffix.lower() == ".txt":
        sessions_dir = get_sessions_dir()
        today = datetime.now().strftime("%Y-%m-%d")
        short_id = p.stem[:8]
        session_file = sessions_dir / f"{today}-{short_id}-session.md"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, session_file)
        print(f"[SessionEnd] Copied txt to session file: {session_file}", file=sys.stderr)
        return

    # Default: parse as JSONL
    messages, meta = parse_transcript(transcript_path)

    # Skip trivial sessions (fewer than 2 meaningful exchanges)
    if sum(1 for m in messages if len(m["text"]) > 20) < 2:
        return

    sessions_dir = get_sessions_dir()
    today = datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now().strftime("%H:%M")
    short_id = get_short_id(meta["session_id"])
    session_file = sessions_dir / f"{today}-{short_id}-session.md"
    project = os.path.basename(meta["cwd"]) if meta["cwd"] else "unknown"
    slug = meta["slug"] or short_id

    sessions_dir.mkdir(parents=True, exist_ok=True)

    if session_file.exists():
        content = session_file.read_text(encoding="utf-8")
        content = re.sub(
            r"\*\*Last Updated:\*\*.*",
            f"**Last Updated:** {current_time}",
            content,
        )
        session_file.write_text(content, encoding="utf-8")
        print(f"[SessionEnd] Updated session file: {session_file}", file=sys.stderr)
    else:
        tools_line = ", ".join(meta["tools_used"]) if meta["tools_used"] else "—"
        files_lines = (
            "\n".join(f"- {f}" for f in meta["files_modified"])
            if meta["files_modified"]
            else "—"
        )
        content = (
            f"# Session: {slug}\n"
            f"**Date:** {today}\n"
            f"**Project:** {project}\n"
            f"**Started:** {current_time}\n"
            f"**Last Updated:** {current_time}\n\n"
            f"**Tools:** {tools_line}\n\n"
            f"**Files Modified:**\n{files_lines}\n\n"
            f"---\n\n"
            f"{build_conversation(messages)}"
        )
        session_file.write_text(content, encoding="utf-8")
        print(f"[SessionEnd] Created session file: {session_file}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        sys.exit(0)

    if hook_input.get("stop_hook_active"):
        sys.exit(0)

    transcript_path = hook_input.get("transcript_path") or os.environ.get(
        "CLAUDE_TRANSCRIPT_PATH"
    )
    if not transcript_path or not Path(transcript_path).exists():
        sys.exit(0)

    run(transcript_path)


if __name__ == "__main__":
    main()
