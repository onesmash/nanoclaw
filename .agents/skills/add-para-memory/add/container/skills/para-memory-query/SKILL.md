---
name: para-memory-query
description: Query and retrieve information from a PARA-structured memory system with three layers (Knowledge Graph, Daily Notes, Tacit Knowledge). Use when the user asks about past information, people, projects, companies, preferences, or events. Triggers include "What do I know about...", "Find information about...", "What happened on...", "How do I prefer...", "What's the status of...", "List all my...", or any query about stored memories, entities, or past conversations.
---

# PARA Memory Query

Query a three-layer memory system organized using the PARA method (Projects, Areas, Resources, Archives).

## Quick Start - ALWAYS START HERE

All scripts are in `{base_dir}/scripts/` (where `{base_dir}` is shown in "Base directory for this skill:" at the top of this context).

| Query type | Script |
|---|---|
| Semantic / unsure | `{base_dir}/scripts/search_qmd.sh "your query"` |
| Date or keyword in timeline | `{base_dir}/scripts/search_timeline.sh keyword "term"` |
| Entity details (person/project/company) | `{base_dir}/scripts/query_entity.sh projects/name` |

**If scripts fail or QMD is unavailable**, fall back to: Grep for content search → Glob for file patterns → direct file reading.

---

## Query Decision Tree

```
Is this about...
├─ A specific entity (person/project/company)?
│  └─ → {base_dir}/scripts/query_entity.sh <path>
│
├─ A specific date or time period?
│  └─ → {base_dir}/scripts/search_timeline.sh date|range|keyword <args>
│
├─ User preferences or working style?
│  └─ → {base_dir}/scripts/search_qmd.sh "query" tacit
│
└─ Unsure or complex query?
   └─ → {base_dir}/scripts/search_qmd.sh "query"
```

## Overview

Three distinct memory layers:

1. **Knowledge Graph** - Entities (people, projects, companies) organized in PARA directories with summary.md and items.json files
2. **Daily Notes** - Chronological timeline of events in dated markdown files (YYYY-MM-DD.md)
3. **Tacit Knowledge** - User patterns, preferences, and working style

### Environment Configuration (Optional)

Set `PARA_MEMORY_ROOT` to customize the memory root directory (defaults to `~/para-memory/`):

```bash
export PARA_MEMORY_ROOT=~/para-memory
```

## Entity Lookups

For queries about people, projects, or companies:

1. **Check if entity exists** in PARA structure:
   - People: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/<name>/`
   - Projects: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/projects/<name>/`
   - Companies: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/companies/<name>/`
   - Resources: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/resources/<topic>/`

2. **Read summary.md first** for quick overview (always start here)

3. **Query items.json for details**:
   ```bash
   {base_dir}/scripts/query_entity.sh areas/people/john-doe
   ```

4. **Filter by category** if needed:
   ```bash
   {base_dir}/scripts/query_entity.sh projects/website '.[] | select(.category == "status")'
   ```

**Fact categories**: `relationship`, `milestone`, `status`, `preference`, `context`

## Timeline Queries

For queries about what happened when:

**Specific date**:
```bash
{base_dir}/scripts/search_timeline.sh date 2026-01-15
```

**Date range**:
```bash
{base_dir}/scripts/search_timeline.sh range 2026-02-01 2026-02-10
```

**Keyword search**:
```bash
{base_dir}/scripts/search_timeline.sh keyword "authentication feature"
```

## Semantic Search with QMD

For complex or semantic queries where exact wording is unknown:

**Search all collections**:
```bash
{base_dir}/scripts/search_qmd.sh "pricing strategy discussion"
```

**Search specific layer**:
- Knowledge graph: `{base_dir}/scripts/search_qmd.sh "John's role" knowledge`
- Daily notes: `{base_dir}/scripts/search_qmd.sh "started project" daily`
- Tacit knowledge: `{base_dir}/scripts/search_qmd.sh "coding preferences" tacit`

**Note**: QMD must be installed and collections configured.

## Fallback: Built-in Tools

Use only when scripts are unavailable:

**Find entities by pattern** (Glob):
```
pattern: **/people/*/summary.md
```

**Search content** (Grep):
```
pattern: "john|Jane"
path: ~/para-memory/knowledge/
```

**Query JSON facts**:
```bash
{base_dir}/scripts/query_entity.sh areas/people/john '.[] | select(.status == "active")'
{base_dir}/scripts/query_entity.sh projects/website '.[] | select(.category == "milestone")'
```

## Tiered Retrieval Strategy

Always follow this order to minimize context usage:

1. **summary.md** - Quick overview (load first)
2. **items.json** - Detailed facts (only if summary insufficient)
3. **Daily notes** - Full timeline (only for historical context)

Facts are organized by recency:
- **Hot** (last 7 days): In summary, most relevant
- **Warm** (8-30 days): In summary, lower priority
- **Cold** (30+ days): In items.json only, searchable but not in summary

## Common Query Patterns

For detailed examples and strategies, see [query-patterns.md](references/query-patterns.md).

**Quick examples**:

- "What do I know about John?" → Read `areas/people/john/summary.md`
- "What's the status of project X?" → Query `projects/X/items.json` for status category
- "What did I do last week?" → Search daily notes by date range
- "How do I prefer to brainstorm?" → Search tacit knowledge
- "List all active projects" → Glob `**/projects/*/summary.md`

---

## File Structure Reference

For detailed schema and format specifications, see [schema.md](references/schema.md).

**Quick reference**:
- Each entity has `summary.md` (overview) and `items.json` (facts array)
- Daily notes: `${PARA_MEMORY_ROOT:-~/para-memory}/memory/YYYY-MM-DD.md`
- Tacit knowledge: `${PARA_MEMORY_ROOT:-~/para-memory}/MEMORY.md`
- PARA categories: `projects/`, `areas/`, `resources/`, `archives/`
