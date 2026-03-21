#!/bin/bash
# Backward-compatible wrapper for task workspace initialization
# Usage: ./init-session.sh [task-slug]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec sh "$SCRIPT_DIR/init-multi-task.sh" "${1:-task}"
