#!/bin/bash
# Search using QMD (if available) across PARA memory collections

set -e

QUERY="$1"
COLLECTION="${2:-all}"  # Default to searching all collections

# Check if qmd is available
if ! command -v qmd &> /dev/null; then
    echo "Error: qmd command not found. Please install QMD or use built-in search tools."
    exit 1
fi

# Perform search based on collection
case "$COLLECTION" in
    knowledge)
        echo "Searching knowledge graph..."
        qmd query "$QUERY" -c knowledge
        ;;
    daily)
        echo "Searching daily notes..."
        qmd query "$QUERY" -c daily
        ;;
    tacit)
        echo "Searching tacit knowledge..."
        qmd query "$QUERY" -c tacit
        ;;
    all|*)
        echo "Searching all collections..."
        qmd query "$QUERY"
        ;;
esac
