#!/bin/bash
# Initialize multi-task planning layout
# Usage: ./init-multi-task.sh [task-slug]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SKILL_DIR/templates"

PLANS_DIR="${1:+plans}"
PLANS_DIR="${PLANS_DIR:-plans}"
TASK_SLUG="${1:-}"

mkdir -p "$PLANS_DIR/_template" "$PLANS_DIR/archive"

copy_if_missing() {
    local src="$1"
    local dest="$2"
    if [ ! -e "$dest" ]; then
        cp "$src" "$dest"
        echo "Created $dest"
    else
        echo "Exists  $dest"
    fi
}

copy_if_missing "$TEMPLATE_DIR/multi-task-README.md" "$PLANS_DIR/README.md"
copy_if_missing "$TEMPLATE_DIR/multi-task-INDEX.md" "$PLANS_DIR/INDEX.md"
copy_if_missing "$TEMPLATE_DIR/task_plan.md" "$PLANS_DIR/_template/task_plan.md"
copy_if_missing "$TEMPLATE_DIR/findings.md" "$PLANS_DIR/_template/findings.md"
copy_if_missing "$TEMPLATE_DIR/progress.md" "$PLANS_DIR/_template/progress.md"

if [ -n "$TASK_SLUG" ]; then
    TASK_DIR="$PLANS_DIR/$TASK_SLUG"
    mkdir -p "$TASK_DIR"
    copy_if_missing "$TEMPLATE_DIR/task_plan.md" "$TASK_DIR/task_plan.md"
    copy_if_missing "$TEMPLATE_DIR/findings.md" "$TASK_DIR/findings.md"
    copy_if_missing "$TEMPLATE_DIR/progress.md" "$TASK_DIR/progress.md"
    echo ""
    echo "Task directory ready: $TASK_DIR"
    echo "Next: cd $TASK_DIR"
else
    echo ""
    echo "Multi-task planning layout ready in $PLANS_DIR"
    echo "Archive directory ready: $PLANS_DIR/archive"
    echo "Next: re-run with a task slug, or create a task directory under $PLANS_DIR/"
fi
