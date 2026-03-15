# Query Patterns and Strategies

This document provides examples of common queries and recommended search strategies for the PARA memory system.

## Table of Contents

1. [Entity Lookups](#entity-lookups)
2. [Timeline Queries](#timeline-queries)
3. [Pattern and Preference Queries](#pattern-and-preference-queries)
4. [Cross-Entity Queries](#cross-entity-queries)
5. [Status and State Queries](#status-and-state-queries)

## Entity Lookups

### Find information about a person

**User query**: "What do I know about John?"

**Strategy**:
1. First check if entity exists: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/john/`
2. Read `summary.md` for quick overview
3. If more detail needed, query `items.json`:
   ```bash
   scripts/query_entity.sh areas/people/john
   ```

### Find information about a project

**User query**: "What's the status of the website redesign?"

**Strategy**:
1. Search for project: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/projects/website-redesign/`
2. Read `summary.md` for current status
3. Filter for status facts:
   ```bash
   scripts/query_entity.sh projects/website-redesign '.[] | select(.category == "status")'
   ```

### Find all entities in a category

**User query**: "List all my active projects"

**Strategy**:
Use Glob to find all entities:
```
**/projects/*/summary.md
```

## Timeline Queries

### What happened on a specific date

**User query**: "What did I do on January 15th?"

**Strategy**:
```bash
scripts/search_timeline.sh date 2026-01-15
```

### What happened last week

**User query**: "What happened last week?"

**Strategy**:
```bash
scripts/search_timeline.sh range 2026-02-03 2026-02-10
```

### When did something happen

**User query**: "When did I start the authentication feature?"

**Strategy**:
1. Search daily notes for keyword:
   ```bash
   scripts/search_timeline.sh keyword "authentication feature"
   ```
2. Or use QMD for semantic search:
   ```bash
   scripts/search_qmd.sh "started authentication feature" memory
   ```

## Pattern and Preference Queries

### How do I prefer to work

**User query**: "How do I like to brainstorm?"

**Strategy**:
1. Read tacit knowledge file: `${PARA_MEMORY_ROOT:-~/para-memory}/MEMORY.md`
2. Or search with QMD:
   ```bash
   scripts/search_qmd.sh "brainstorming preferences" tacit
   ```

### What tools do I use

**User query**: "What's my preferred editor?"

**Strategy**:
Search tacit knowledge for tool preferences using Grep:
```
pattern: "editor|IDE|coding tool"
path: ${PARA_MEMORY_ROOT:-~/para-memory}/MEMORY.md
```

## Cross-Entity Queries

### Find all interactions with a person

**User query**: "What have I discussed with Jane recently?"

**Strategy**:
1. Read person's summary: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/people/jane/summary.md`
2. Query related facts:
   ```bash
   scripts/query_entity.sh areas/people/jane '.[] | select(.category == "context")'
   ```
3. Search daily notes:
   ```bash
   scripts/search_timeline.sh keyword "Jane"
   ```

### Find all work related to a company

**User query**: "What projects am I doing for Acme Corp?"

**Strategy**:
1. Read company entity: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/areas/companies/acme/summary.md`
2. Search for related projects using Grep:
   ```
   pattern: "acme"
   path: ${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/projects/
   ```

## Status and State Queries

### Find all active items

**User query**: "What am I currently working on?"

**Strategy**:
1. List all projects (active work): Glob `**/projects/*/summary.md`
2. For each project, check status in summary or query:
   ```bash
   scripts/query_entity.sh projects/PROJECT_NAME '.[] | select(.status == "active" and .category == "status")'
   ```

### Find archived work

**User query**: "What projects did I complete last year?"

**Strategy**:
1. Check archives: `${PARA_MEMORY_ROOT:-~/para-memory}/knowledge/archives/`
2. Use QMD to search by date:
   ```bash
   scripts/search_qmd.sh "completed 2025" knowledge
   ```
3. Or search daily notes for completion events:
   ```bash
   scripts/search_timeline.sh keyword "completed"
   ```

## Search Tool Selection

### When to use QMD

- Semantic searches where exact wording is unknown
- Cross-collection searches
- Searches that benefit from relevance ranking
- Complex queries with multiple criteria

### When to use Grep

- Exact keyword or pattern matching
- Searching within specific directories
- Fast, simple lookups
- Regex pattern matching

### When to use Glob

- Finding files by path patterns
- Listing entities in categories
- Directory structure navigation
- Wildcard file matching

### When to use jq (via query_entity.sh)

- Filtering JSON facts by specific criteria
- Extracting specific fields from facts
- Complex queries on fact metadata (status, category, dates)
- Analyzing fact relationships

## Performance Tips

1. **Start with summaries**: Always check `summary.md` before loading full `items.json`
2. **Use tiered retrieval**: Summary → Full facts → Daily notes (in that order)
3. **Target specific collections**: Use QMD collection filters when possible
4. **Leverage fact categories**: Filter by category to narrow results quickly
5. **Check lastAccessed**: Recent facts are more likely to be relevant
