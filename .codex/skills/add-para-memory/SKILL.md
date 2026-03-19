---
name: add-para-memory
description: Add PARA memory system to NanoClaw container agents. Installs para-memory (write/manage structured knowledge graph, daily notes, tacit knowledge) and para-memory-query (query past information, people, projects, companies, preferences). Use when you want agents to remember information across conversations, track entities and relationships, or answer questions about past interactions.
---

# Add PARA Memory

Installs the PARA memory system into NanoClaw container agents. After applying, agents can:
- Write and maintain a structured knowledge graph (Projects/Areas/Resources/Archives)
- Record daily notes as conversation timeline
- Track user preferences and working patterns
- Query past conversations, people, companies, and projects

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `add-para-memory` is in `applied_skills`, skip to Phase 3 (Verify).

## Phase 2: Apply

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist:

```bash
npx tsx scripts/apply-skill.ts --init
```

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-para-memory
```

This copies to `container/skills/`:
- `para-memory/` — knowledge graph write/update scripts + weekly synthesis
- `para-memory-query/` — query scripts for entities, timeline, and semantic search

### Initialize PARA memory structure

```bash
PARA_ROOT="${PARA_MEMORY_ROOT:-$HOME/para-memory}"
python container/skills/para-memory/scripts/init_memory_system.py "$PARA_ROOT"
```

This creates:
- `$PARA_ROOT/knowledge/` — PARA directories (projects/, areas/, resources/, archives/)
- `$PARA_ROOT/memory/` — daily notes with today's file
- `$PARA_ROOT/MEMORY.md` — tacit knowledge file

### Configure environment variable (if not already set)

Check `.env` in the project root. If `PARA_MEMORY_ROOT` is not present, append it:

```bash
echo "PARA_MEMORY_ROOT=$HOME/para-memory" >> .env
```

Skip if the variable is already defined.

### Update MEMORY.md

Append the following to `groups/main/MEMORY.md` (skip if already present):

```
## PARA Memory System

para-memory and para-memory-query skills are installed.

**Writing memories:**
- Use `para-memory` to extract facts from conversations and update the knowledge graph
- Identify durable facts (relationships, milestones, status, preferences, context)
- Create entities when people/projects/companies are mentioned 3+ times
- Store facts with `scripts/update_entity.py`

**Querying memories:**
- Use `para-memory-query` to retrieve information about past interactions
- Start with summary.md for quick entity overviews
- Use search scripts for timeline and semantic queries
- Memory root: ${PARA_MEMORY_ROOT:-~/para-memory}
```

### Add scheduled maintenance tasks to HEARTBEAT.md

Append to `groups/main/HEARTBEAT.md` (skip if lines already exist):

```
# PARA Memory — daily fact extraction (run at end of day or periodically)
- Read today's daily note at ${PARA_MEMORY_ROOT:-~/para-memory}/memory/YYYY-MM-DD.md
- Extract 3-5 durable facts (relationships, milestones, status, preferences, context)
- For each fact: find or create entity, add/supersede with update_entity.py
- If new user patterns emerged, update ${PARA_MEMORY_ROOT:-~/para-memory}/MEMORY.md
- Otherwise reply HEARTBEAT_OK

# PARA Memory — weekly synthesis (run on Sundays or weekly)
- Run: python scripts/weekly_synthesis.py ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge
- This applies memory decay (hot/warm/cold tiers) and regenerates summaries
- Then run: qmd update && qmd embed (if qmd is installed)
- Otherwise reply HEARTBEAT_OK
```

### Configure QMD Search (Optional but recommended)

Ask the user which search backend to use:

> "QMD provides enhanced search for your memory system. Choose an option:
> 1. **Local model** — Semantic search using a local embedding model; no cloud API required
> 2. **API (SiliconFlow)** — Semantic search, query expansion, and reranking via SiliconFlow cloud API
> 3. **Skip** — No QMD; para-memory-query falls back to Grep/Glob"

Run the steps for the chosen option:

#### Option 1: Local model

```bash
# Install QMD
npm install -g @tobilu/qmd

# macOS: install Homebrew SQLite for extension support
brew install sqlite

# Add collections
PARA_ROOT="${PARA_MEMORY_ROOT:-$HOME/para-memory}"
qmd collection add "$PARA_ROOT/knowledge" --name knowledge -mask "**/*.{md,json}
qmd collection add "$PARA_ROOT/memory" --name daily --mask "**/*.md"
qmd collection add "$PARA_ROOT" --name tacit --mask "**/*.md" --mask "MEMORY.md"
qmd context add qmd://knowledge "PARA-organized entities: people, companies, projects with atomic facts"
qmd context add qmd://daily "Daily conversation timeline and event log"
qmd context add qmd://tacit "Long term memory"

# Build index and generate vector embeddings
qmd update
qmd embed
```

#### Option 2: API (SiliconFlow)

```bash
# Install QMD
npm install -g @onesmash/qmd
brew install sqlite  # macOS

qmd init

# Edit ~/.config/qmd/api.yml with your SiliconFlow API key

# Add collections
PARA_ROOT="${PARA_MEMORY_ROOT:-$HOME/para-memory}"
qmd collection add "$PARA_ROOT/knowledge" --name knowledge -mask "**/*.{md,json}
qmd collection add "$PARA_ROOT/memory" --name daily --mask "**/*.md"
qmd collection add "$PARA_ROOT" --name tacit --mask "**/*.md" --mask "MEMORY.md"
qmd context add qmd://knowledge "PARA-organized entities: people, companies, projects with atomic facts"
qmd context add qmd://daily "Daily conversation timeline and event log"
qmd context add qmd://tacit "Long term memory"

# Build index and generate vector embeddings
qmd update
qmd embed
```

To get a SiliconFlow API key: sign up at https://siliconflow.cn and create a key in the dashboard.

#### Option 3: Skip

`para-memory-query` automatically falls back to Grep (content search) and Glob (file pattern matching). All functionality works; semantic search is unavailable.

---

### Restart service

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 3: Verify

### Test memory write

Send a message to any registered group:

> "Remember: I prefer to handle complex tasks in the morning and communication work in the afternoon."

The agent should use `para-memory` to update tacit knowledge in `${PARA_MEMORY_ROOT:-~/para-memory}/MEMORY.md`.

### Test memory query

Send a follow-up message:

> "What are my work preferences?"

The agent should use `para-memory-query` to retrieve from tacit knowledge and respond accurately.

### Check knowledge graph directory

```bash
ls ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/
# Should show: projects/  areas/  resources/  archives/
```

## Notes

- `PARA_MEMORY_ROOT` defaults to `~/para-memory/` if not set
- Scripts operate on the host filesystem, not inside the container VM
- Memory persists across sessions and service restarts
- To remove: delete `container/skills/para-memory/` and `container/skills/para-memory-query/`, revert MEMORY.md and HEARTBEAT.md additions, then restart the service
