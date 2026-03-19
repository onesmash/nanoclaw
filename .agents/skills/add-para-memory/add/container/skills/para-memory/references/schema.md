# Atomic Fact Schema

Every fact in `items.json` follows this schema:

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

## Required Fields

### id (string)
Unique identifier for the fact. Format: `{entity-name}-{number}`

Example: `"john-doe-001"`

### fact (string)
The actual factual statement. Should be:
- Specific and concrete
- Self-contained (readable without context)
- Timestamped when relevant

Good: "Joined Acme Corp as CTO in March 2025"
Bad: "Got promoted"

### category (string)
One of:
- `relationship` - Connections to other entities
- `milestone` - Significant events or achievements
- `status` - Current state or role
- `preference` - Likes, dislikes, working style
- `context` - Background information

### timestamp (string)
When the fact occurred (not when it was recorded). Format: `YYYY-MM-DD`

For ongoing facts, use the start date.

### source (string)
Where this fact came from. Typically a date (from daily notes) or a reference.

Format: `YYYY-MM-DD` for daily notes, or descriptive string like "LinkedIn profile"

## Status Fields

### status (string)
Either:
- `active` - Current, accurate fact
- `superseded` - Outdated, replaced by newer fact

Never delete facts. Mark as superseded instead.

### supersededBy (string or null)
If status is `superseded`, this contains the ID of the fact that replaced it.

Creates a chain: fact A → fact B → fact C

## Relationship Fields

### relatedEntities (array of strings)
References to other entities in the graph. Format: `category/entity-name`

Examples:
- `"companies/acme"`
- `"people/jane-smith"`
- `"projects/product-launch"`

This is what makes it a graph rather than isolated notes.

## Access Tracking Fields

### lastAccessed (string)
Date this fact was last retrieved or referenced. Format: `YYYY-MM-DD`

Updated when:
- Fact is loaded into context
- Fact is referenced in conversation
- Fact appears in search results that are used

### accessCount (integer)
Number of times this fact has been accessed.

Used for frequency resistance in memory decay - high access count prevents facts from going cold too quickly.

## Memory Decay Tiers

Based on `lastAccessed` and `accessCount`:

**Hot** (accessed last 7 days)
- Prominently included in summary.md
- First thing agent sees

**Warm** (accessed 8-30 days ago)
- Included in summary.md at lower priority
- Available but not front-of-mind

**Cold** (not accessed 30+ days)
- Omitted from summary.md
- Still in items.json, searchable
- Accessing it reheats to Hot

**Frequency Resistance**
Facts with `accessCount > 10` get bonus time before going cold.

## Example Fact Lifecycle

```json
// Initial fact
{
  "id": "john-001",
  "fact": "Works at Acme Corp as Senior Engineer",
  "category": "status",
  "timestamp": "2024-01-15",
  "source": "2024-01-15",
  "status": "active",
  "supersededBy": null,
  "relatedEntities": ["companies/acme"],
  "lastAccessed": "2024-01-15",
  "accessCount": 1
}

// After promotion (old fact superseded, new fact added)
{
  "id": "john-001",
  "fact": "Works at Acme Corp as Senior Engineer",
  "category": "status",
  "timestamp": "2024-01-15",
  "source": "2024-01-15",
  "status": "superseded",
  "supersededBy": "john-005",
  "relatedEntities": ["companies/acme"],
  "lastAccessed": "2024-01-15",
  "accessCount": 1
}

{
  "id": "john-005",
  "fact": "Promoted to Engineering Manager at Acme Corp",
  "category": "milestone",
  "timestamp": "2025-03-01",
  "source": "2025-03-01",
  "status": "active",
  "supersededBy": null,
  "relatedEntities": ["companies/acme"],
  "lastAccessed": "2025-03-01",
  "accessCount": 1
}
```
