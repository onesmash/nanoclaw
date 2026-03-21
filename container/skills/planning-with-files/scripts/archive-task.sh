#!/bin/bash
# Archive a completed task directory under plans/archive/
# Usage: ./archive-task.sh <task-slug>

set -euo pipefail

TASK_SLUG="${1:-}"

if [ -z "$TASK_SLUG" ]; then
    echo "Usage: $0 <task-slug>"
    exit 1
fi

case "$TASK_SLUG" in
    "."|".."|"_template"|"archive")
        echo "Refusing to archive reserved task slug: $TASK_SLUG"
        exit 1
        ;;
esac

PLANS_DIR="plans"
SOURCE_DIR="$PLANS_DIR/$TASK_SLUG"
ARCHIVE_DIR="$PLANS_DIR/archive"
DEST_DIR="$ARCHIVE_DIR/$TASK_SLUG"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Task directory not found: $SOURCE_DIR"
    exit 1
fi

if [ -e "$DEST_DIR" ]; then
    echo "Archive target already exists: $DEST_DIR"
    exit 1
fi

mkdir -p "$ARCHIVE_DIR"
mv "$SOURCE_DIR" "$DEST_DIR"
echo "Archived $SOURCE_DIR -> $DEST_DIR"
