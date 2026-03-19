---
name: para-memory
description: Implement and manage durable, structured memory using PARA (Projects/Areas/Resources/Archives) with atomic facts, memory decay (hot/warm/cold tiers), and search integration. Use when needs to (1) Set up a persistent knowledge graph for tracking entities, (2) Manage daily notes as conversation timeline, (3) Track user preferences and working patterns, (4) Extract and organize durable facts from conversations, (5) Apply memory decay to prioritize recent/frequent information. Ideal for building AI assistants that remember context across conversations and maintain long-term relational knowledge.
---

# PARA Memory System

Implement durable, structured memory for AI agents using PARA framework with atomic facts and memory decay.

## System Architecture

Three memory layers:

**Knowledge Graph** (PARA structure)
- Entities organized as Projects/Areas/Resources/Archives
- Each entity has `summary.md` (quick context) and `items.json` (atomic facts)
- Facts never deleted, only superseded
- Memory decay: hot (7d) → warm (30d) → cold (30d+)

**Daily Notes** (timeline)
- Dated markdown files capturing conversations chronologically
- Raw, unstructured timeline of events
- Source for fact extraction

**Tacit Knowledge** (user model)
- Single file with user preferences, working style, tool preferences
- Updated when new patterns emerge

## Quick Start

All scripts are in `{base_dir}/scripts/` (where `{base_dir}` is shown in "Base directory for this skill:" at the top of this context).

### Environment Configuration (Optional)

Set the `PARA_MEMORY_ROOT` environment variable to customize the root directory:

```bash
# Set in your shell profile (~/.bashrc, ~/.zshrc, etc.)
export PARA_MEMORY_ROOT=~/para-memory

# Or use a custom location
export PARA_MEMORY_ROOT=/path/to/my/memory
```

**Default:** If not set, defaults to `~/para-memory/`

### 1. Initialize System

```bash
python {base_dir}/scripts/init_memory_system.py ${PARA_MEMORY_ROOT:-~/para-memory}
```

Creates:
- PARA directories (projects/, areas/, resources/, archives/)
- Daily notes directory `memory` with today's file
- Tacit knowledge `MEMORY.md`

### 2. Create First Entity

```bash
# Create a person entity
python {base_dir}/scripts/create_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge people "John Doe"

# Create a company entity
python {base_dir}/scripts/create_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge companies "Acme Corp"

# Create a project entity
python {base_dir}/scripts/create_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge projects "Product Launch"
```

### 3. Add Facts to Entity

```bash
# Add a fact
python {base_dir}/scripts/update_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/john-doe \
  --add '{
    "fact": "Joined Acme Corp as CTO in March 2025",
    "category": "milestone",
    "timestamp": "2025-03-15",
    "source": "2025-03-15",
    "relatedEntities": ["companies/acme"]
  }'

# Supersede old fact with new one
python {base_dir}/scripts/update_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/john-doe \
  --supersede john-doe-001 '{
    "fact": "Promoted to VP Engineering at Acme Corp",
    "category": "milestone",
    "timestamp": "2026-01-15",
    "source": "2026-01-15",
    "relatedEntities": ["companies/acme"]
  }'
```

### 4. Run Weekly Synthesis

```bash
# Apply memory decay, regenerate summaries, and update search index
python {base_dir}/scripts/weekly_synthesis.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge
```

### 5. Register SessionEnd Hook

Automatically saves each conversation as a markdown file in `${PARA_MEMORY_ROOT:-~/para-memory}/memory/sessions/` when a Claude Code session ends.

Run the installer to copy scripts to `~/.claude/hooks/para-memory/` and register the hook:

```bash
python {base_dir}/scripts/install_hooks.py
```

This copies `save_chat_history.py` to `~/.claude/hooks/para-memory/` and updates `~/.claude/settings.json` to point to it, decoupling the hook from the repo location.

## Working with Entities

### Entity Structure

```
areas/people/john-doe/
├── summary.md      # Quick overview (loaded first)
└── items.json      # Atomic facts (loaded as needed)
```

**When to use each:**
- Load `summary.md` for quick context about an entity
- Load `items.json` when you need detailed fact history or specific timestamps
- Memory decay ensures `summary.md` stays lean with only relevant facts

### PARA Categories

**Projects** - Active work with goals/deadlines
- Goes to Archives when complete
- Example: product-launch, home-renovation

**Areas** - Ongoing responsibilities (no end date)
- `people/` - Individuals
- `companies/` - Organizations
- Persist indefinitely

**Resources** - Reference material, topics of interest
- Example: machine-learning, design-patterns

**Archives** - Inactive items
- Nothing deleted, just moved here

### Memory Decay Tiers

Facts classified by `lastAccessed` date:

**Hot** (≤7 days) - Prominent in summary.md
**Warm** (8-30 days) - Lower priority in summary.md
**Cold** (>30 days) - Omitted from summary.md, but remain in items.json

**Frequency Resistance:** Facts with `accessCount > 10` resist decay (bonus 5 days)

### Updating Access Tracking

When referencing a fact in conversation:

```python
# In items.json, update:
{
  "lastAccessed": "2026-02-07",  # Today
  "accessCount": 13               # Increment
}
```

Run weekly synthesis to apply decay.

## Fact Extraction Workflow

**This is an AI-assisted process.** AI assistant performs semantic understanding to extract durable facts from conversations.

### Step 1: Review Daily Notes

System automatically maintains daily notes during conversations. At end of day/session:

1. **Read today's daily note** to see what was discussed
2. **Identify durable facts** worth preserving

### Step 2: Categorize Facts

Identify facts worth preserving by category:

**Extract:**
- **Relationships** - Who knows whom, who works where
- **Milestones** - Promotions, project launches, significant events
- **Status** - Current roles, project phases, ongoing states
- **Preferences** - Communication style, tool choices, working patterns
- **Context** - Background information, constraints, decisions

**Skip:**
- Transient requests ("can you help with...")
- Casual chat
- Already-captured information
- Temporary states

### Step 3: Add Facts to Knowledge Graph

For each identified fact, use `update_entity.py`:

```bash
python {base_dir}/scripts/update_entity.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/john \
  --add '{
    "fact": "Leading new API project starting Q1 2026",
    "category": "status",
    "timestamp": "2026-02-07",
    "source": "2026-02-07",
    "relatedEntities": ["projects/api-redesign"]
  }'
```

**Determine the entity:**
- If entity doesn't exist, create it first with `create_entity.py`
- If fact supersedes old information, use `--supersede` instead of `--add`

### Step 4: Update Tacit Knowledge (if needed)

If conversation reveals new user patterns, update `MEMORY.md`:

```markdown
## Communication Preferences

- Prefers detailed technical explanations
- Likes code examples over pseudocode
- Values conciseness in summaries

## Working Style

- Works in 2-hour focused blocks
- Prefers morning for complex tasks
```

## Fact Extraction Prompt

**For AI assistants performing extraction, use this workflow:**

```
1. Read base_path/memory/YYYY-MM-DD.md
2. For each conversation/event:
   - Identify: What information has lasting value?
   - Categorize: relationship/milestone/status/preference/context
   - Determine entity: Which person/company/project?
3. For each fact:
   - Check if entity exists, create if needed
   - Check if fact supersedes existing, use --supersede if so
   - Add fact with proper category, timestamp (when fact occurred), source
4. Update tacit knowledge if new patterns emerged
```

## Maintenance Cadence

**During conversations:**
- System automatically writes daily notes
- Update `lastAccessed` and `accessCount` when facts referenced

**Daily/Periodic (AI-assisted):**
- AI reviews `${PARA_MEMORY_ROOT:-~/para-memory}/memory/YYYY-MM-DD.md` for durable facts
- AI extracts and categorizes facts
- AI adds facts to appropriate entities using `update_entity.py`
- AI updates tacit knowledge if new patterns emerge

**Weekly (Automated):**
```bash
# Run synthesis (automatically updates QMD index and embeddings)
python {base_dir}/scripts/weekly_synthesis.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge
```

This applies memory decay, regenerates summaries, and updates search index.

## Entity Creation Heuristics

Create entity when:
- Mentioned 3+ times
- Has direct relationship to user
- Significant project/company in user's life

Otherwise:
- Capture in daily notes only
- Create entity later if it becomes important

Prevents graph clutter while ensuring important entities tracked.

## Schema Reference

See **references/schema.md** for complete atomic fact schema with:
- Required fields (id, fact, category, timestamp, source)
- Status fields (status, supersededBy)
- Relationship fields (relatedEntities)
- Access tracking (lastAccessed, accessCount)
- Categories (relationship, milestone, status, preference, context)
- Complete examples

## Advanced: Fact Supersession

When facts become outdated, create supersession chain:

```json
// Old fact
{
  "id": "john-001",
  "fact": "Works as Senior Engineer at Acme",
  "status": "superseded",
  "supersededBy": "john-005"
}

// New fact
{
  "id": "john-005",
  "fact": "Promoted to Engineering Manager at Acme",
  "status": "active",
  "supersededBy": null
}
```

Preserves history while keeping active set clean.

## Install QMD

QMD provides local search (BM25 keyword, vector semantic, hybrid with reranking) over your memory layers. Essential once you have 10+ entities or 30+ days of daily notes.
See references/qmd_setup.md for full installation and configuration.

```bash
npm install -g @tobilu/qmd
```

### Add collections (one-time)

```bash
qmd collection add ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge --name knowledge --mask "**/*.{md,json}"
qmd collection add ${PARA_MEMORY_ROOT:-~/para-memory}/memory --name daily --mask "**/*.md"
qmd collection add ${PARA_MEMORY_ROOT:-~/para-memory} --name tacit --mask "MEMORY.md"
```

### Index and embed

```bash
qmd update
qmd embed
```

## Resources

**Scripts:**
- `init_memory_system.py` - Initialize PARA structure
- `create_entity.py` - Create new entity with templates
- `update_entity.py` - Add/supersede facts
- `weekly_synthesis.py` - Apply memory decay, regenerate summaries
- `save_chat_history.py` - SessionEnd hook: save raw conversation to per-session markdown file

**References:**
- `schema.md` - Complete atomic fact schema and examples
- `qmd_setup.md` - QMD installation and search patterns
