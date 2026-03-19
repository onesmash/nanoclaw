# PARA Memory System Schema

This document describes the structure and format of the PARA memory system.

## Directory Structure

```
para-memory/
├── knowledge/           # Knowledge graph (PARA)
│   ├── projects/        # Active work with goals/deadlines
│   ├── areas/           # Ongoing responsibilities
│   │   ├── people/      # People you know
│   │   └── companies/   # Companies you work with
│   ├── resources/       # Topics of interest
│   ├── archives/        # Inactive items
│   └── index.md         # Overview
├── memory/              # Daily notes (chronological timeline)
│   ├── 2026-01-28.md
│   ├── 2026-01-29.md
│   └── ...
└── MEMORY.md               # User patterns and preferences
```

## Entity Files

Each entity in the knowledge graph has two files:

### summary.md

A concise overview loaded first for quick context. Contains:
- Brief description of the entity
- Current status
- Recent activity (Hot facts - accessed in last 7 days)
- Relevant context (Warm facts - accessed 8-30 days ago)

### items.json

Array of atomic facts with the following schema:

```json
{
  "id": "entity-001",
  "fact": "Joined the company as CTO in March 2025",
  "category": "milestone",
  "timestamp": "2025-03-15",
  "source": "2025-03-15",
  "status": "active",
  "supersededBy": null,
  "relatedEntities": ["companies/acme", "people/jane"],
  "lastAccessed": "2026-01-28",
  "accessCount": 12
}
```

## Fact Schema Fields

- **id**: Unique identifier for the fact
- **fact**: The actual information (what happened, what changed, what's true)
- **category**: One of: `relationship`, `milestone`, `status`, `preference`, `context`
- **timestamp**: When the fact was created or occurred (ISO 8601 format)
- **source**: Reference to the daily note where this was extracted from
- **status**: Either `active` or `superseded` (facts are never deleted)
- **supersededBy**: ID of the fact that replaced this one (if superseded)
- **relatedEntities**: Array of paths to related entities (e.g., `["people/john", "projects/website"]`)
- **lastAccessed**: Last time this fact was used (ISO 8601 date)
- **accessCount**: Number of times this fact has been accessed

## Fact Categories

- **relationship**: How entities relate to each other
- **milestone**: Significant events or achievements
- **status**: Current state or condition
- **preference**: User preferences or choices
- **context**: Background information or details

## Memory Decay Tiers

Facts are organized into three tiers based on recency and access:

- **Hot** (accessed in last 7 days): Prominently included in summary.md
- **Warm** (accessed 8-30 days ago): Included in summary.md at lower priority
- **Cold** (not accessed in 30+ days): Omitted from summary.md but remain in items.json

## PARA Categories

- **Projects**: Active work with clear goals or deadlines. Moves to Archives when complete.
- **Areas**: Ongoing responsibilities with no end date (people, companies, roles)
- **Resources**: Reference material and topics of interest
- **Archives**: Inactive items from any category (never deleted, just moved here)

## Daily Notes Format

Daily notes are chronological markdown files named `YYYY-MM-DD.md`:

```markdown
# 2026-01-28

## Morning
- Met with John about the website redesign
- Discussed new color scheme

## Afternoon
- Reviewed pull request for authentication feature
- Updated project timeline
```

## Tacit Knowledge Format

Single markdown file capturing user patterns:

```markdown
# Communication Preferences
- Prefers concise responses
- Likes technical details

# Working Style
- Brainstorms visually first
- Makes decisions based on data

# Tool Preferences
- Uses VS Code for coding
- Prefers command-line tools
```
