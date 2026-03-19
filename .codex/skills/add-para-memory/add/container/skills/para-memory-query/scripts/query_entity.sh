#!/bin/bash
# Query entity facts from items.json using jq

set -e

MEMORY_ROOT="${PARA_MEMORY_ROOT:-$HOME/para-memory}"
ENTITY_PATH="$1"
FILTER="${2:-.}"  # Default to showing all facts

# Validate inputs
if [ -z "$ENTITY_PATH" ]; then
    echo "Usage: $0 <entity-path> [jq-filter]"
    echo "Example: $0 people/john-doe"
    echo "Example: $0 projects/website-redesign '.[] | select(.status == \"active\")'"
    exit 1
fi

# Construct full path to items.json
ITEMS_FILE="$MEMORY_ROOT/knowledge/$ENTITY_PATH/items.json"

if [ ! -f "$ITEMS_FILE" ]; then
    echo "Error: Entity file not found: $ITEMS_FILE"
    exit 1
fi

# Query using jq
echo "Querying entity: $ENTITY_PATH"
echo "---"
jq "$FILTER" "$ITEMS_FILE"
