#!/bin/bash
# Search daily notes by date range or keyword

set -e

MEMORY_ROOT="${PARA_MEMORY_ROOT:-$HOME/para-memory}"
DAILY_NOTES_DIR="$MEMORY_ROOT/memory"  # Assuming memory/ is sibling to knowledge/

MODE="$1"
shift

case "$MODE" in
    date)
        # Search by specific date
        DATE="$1"
        FILE="$DAILY_NOTES_DIR/$DATE.md"
        if [ -f "$FILE" ]; then
            cat "$FILE"
        else
            echo "No notes found for date: $DATE"
            exit 1
        fi
        ;;
    range)
        # Search by date range
        START_DATE="$1"
        END_DATE="$2"
        echo "Searching notes from $START_DATE to $END_DATE..."
        for file in "$DAILY_NOTES_DIR"/*.md; do
            filename=$(basename "$file" .md)
            if [[ ("$filename" > "$START_DATE" || "$filename" = "$START_DATE") && ("$filename" < "$END_DATE" || "$filename" = "$END_DATE") ]]; then
                echo "=== $filename ==="
                cat "$file"
                echo ""
            fi
        done
        ;;
    keyword)
        # Search by keyword across all daily notes
        KEYWORD="$1"
        echo "Searching for keyword: $KEYWORD"
        grep -r "$KEYWORD" "$DAILY_NOTES_DIR" --include="*.md" -n
        ;;
    *)
        echo "Usage: $0 <mode> [args]"
        echo "Modes:"
        echo "  date <YYYY-MM-DD>              - Show notes for specific date"
        echo "  range <start-date> <end-date>  - Show notes in date range"
        echo "  keyword <term>                 - Search for keyword across all notes"
        exit 1
        ;;
esac
