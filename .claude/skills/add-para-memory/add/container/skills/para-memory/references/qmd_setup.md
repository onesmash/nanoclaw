# QMD Setup Guide

QMD (https://github.com/tobi/qmd) provides local semantic search for the memory system. Runs entirely offline — no API keys required. Models auto-download on first use.

## Requirements

- Node.js >= 22
- macOS: Homebrew SQLite for extension support

## Installation

```bash
npm install -g @tobilu/qmd
# macOS only:
brew install sqlite
```

Ensure your npm global bin is in PATH (usually `~/.npm-global/bin` or the output of `npm bin -g`).

## Setting Up Collections

Collections map to the three memory layers:

```bash
# Knowledge graph (PARA structure)
qmd collection add base_path/knowledge --name knowledge --mask "**/*.{md,json}"

# Daily notes (timeline)
qmd collection add base_path/memory --name daily --mask "**/*.md"

# Tacit knowledge
qmd collection add base_path --name tacit --mask "MEMORY.md"

# List collections
qmd collection list
```

## Adding Context

Add descriptive metadata to help search understand your content:

```bash
qmd context add qmd://knowledge "PARA-organized entities: people, companies, projects with atomic facts"
qmd context add qmd://daily "Daily conversation timeline and event log"
qmd context add qmd://tacit "Long term memory"
```

## Indexing

Generate vector embeddings for semantic search (models auto-download to `~/.cache/qmd/models/` on first run):

```bash
# Initial embedding
qmd embed

# Force re-embed everything
qmd embed -f
```

Update the index when documents change:

```bash
# Update index
qmd update
```

## Search Modes

QMD provides three search modes:

### Keyword Search
Fast BM25 full-text search. Good for finding specific facts.

```bash
# Search across all collections
qmd search "Jane's role at Acme"

# Search in specific collection
qmd search "Jane's role" -c knowledge

# Get more results
qmd search "pricing" -n 10
```

### Semantic Search
Vector similarity search. Good for finding related information.

```bash
# Semantic search
qmd vsearch "career changes and promotions"

# In specific collection
qmd vsearch "project timeline discussions" -c daily
```

### Hybrid Search (Recommended)
Combines keyword and semantic search with reranking.

```bash
# Best for most queries
qmd query "when did the project scope change"

# Specify collection
qmd query "Jane's preferences" -c knowledge

# More results
qmd query "meetings about product" -n 15
```

## Common Options

- `-n <num>` - Number of results (default: 5)
- `-c, --collection` - Restrict to specific collection
- `--all` - Return all matches
- `--json` - JSON output for scripting
- `--files` - List format with scores
- `--min-score <num>` - Filter by relevance threshold

## Retrieving Documents

Get specific documents:

```bash
# By path
qmd get "areas/people/john-doe/summary.md"

# Using glob patterns
qmd multi-get "areas/people/*/summary.md"
```

## MCP Server

QMD can expose search as an MCP tool for AI agents:

```bash
qmd mcp
```

## Integration with Memory System

### After fact extraction
Update index when new facts are added:

```bash
qmd update
```

### During weekly synthesis
Update index and rebuild embeddings:

```bash
qmd update
qmd embed
```

### During conversation
Search before loading into context:

```bash
# Find relevant entities
qmd query "customer feedback" -c knowledge

# Then load only relevant summary.md files
```

## Maintenance

**After adding/updating entities:**
```bash
qmd update
qmd embed
```

**Weekly synthesis:**
```bash
qmd update  # Update index
qmd embed   # Rebuild embeddings
```

**When search quality degrades:**
```bash
qmd embed -f  # Force full re-embedding
```

## Troubleshooting

**Command not found**
- Ensure npm global bin is in PATH: `npm bin -g`
- Reinstall: `npm install -g @tobilu/qmd`

**Poor semantic search results**
- Rebuild embeddings: `qmd embed -f`
- Models stored at `~/.cache/qmd/models/`

**Out of date results**
- Update index: `qmd update`
- Check collection paths: `qmd collection list`

**Slow searches**
- Reduce result count: `-n 5`
- Use keyword search for exact matches
- Check database size: `qmd ls <collection>`
