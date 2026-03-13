## Tasks

- [ ] 1. Review and confirm spec delta in `specs/cursor-agent-execution/spec.md` accurately
  reflects the two-file invariant and in-memory nanoclaw injection behaviour
- [ ] 2. Run `openspec validate write-group-mcp-source --strict` and resolve any issues
- [ ] 3. Manually verify: send a message, confirm `groups/main/.cursor/mcp.json` is not
  modified by cursor-runner, and the proxy session succeeds with nanoclaw tools available
