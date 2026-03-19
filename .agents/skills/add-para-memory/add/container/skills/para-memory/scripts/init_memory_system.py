#!/usr/bin/env python3
"""
Initialize PARA memory system directory structure.

Usage: python init_memory_system.py [base_path]
If base_path is not provided, uses PARA_MEMORY_ROOT environment variable.
If environment variable not set, defaults to ~/para-memory
"""

import sys
import os
from pathlib import Path
from datetime import datetime


def create_directory_structure(base_path):
    """Create PARA directory structure."""
    base = Path(base_path)

    # Main PARA directories
    directories = [
        "memory",
        "knowledge/projects",
        "knowledge/areas/people",
        "knowledge/areas/companies",
        "knowledge/resources",
        "knowledge/archives"
    ]

    for dir_path in directories:
        (base / dir_path).mkdir(parents=True, exist_ok=True)

    # Create index.md
    index_content = """# Knowledge Graph

This knowledge graph uses the PARA method to organize entities:

- **projects/** - Active work with clear goals/deadlines
- **areas/** - Ongoing responsibilities (no end date)
  - people/ - Individuals you know
  - companies/ - Organizations you work with
- **resources/** - Topics of interest, reference material
- **archives/** - Inactive items from any category
Each entity has:
- `summary.md` - Quick overview (loaded first)
- `items.json` - Atomic facts (loaded as needed)
"""
    (base / "knowledge/index.md").write_text(index_content)

    return base


def get_base_path(provided_path=None):
    """Get base path from argument, environment variable, or default."""
    if provided_path:
        return Path(os.path.expanduser(provided_path))
    
    env_path = os.environ.get('PARA_MEMORY_ROOT')
    if env_path:
        return Path(os.path.expanduser(env_path))
    
    # Default path
    return Path(os.path.expanduser('~/para-memory'))


def main():
    # Handle 0 or 1 arguments
    if len(sys.argv) > 2:
        print("Usage: python init_memory_system.py [base_path]")
        print("If base_path is not provided, uses PARA_MEMORY_ROOT environment variable.")
        print("If environment variable not set, defaults to ~/para-memory.")
        sys.exit(1)
    
    base_path_arg = sys.argv[1] if len(sys.argv) == 2 else None
    base_path = get_base_path(base_path_arg)

    print(f"Initializing memory system at: {base_path}")

    # Create structures
    knowledge_base = create_directory_structure(base_path)
    print(f"✓ Created knowledge graph at: {knowledge_base}")

    print("\n✓ Memory system initialized successfully!")
    print("\nNext steps:")
    print("1. Create your first entity using create_entity.py")
    print("2. Set up QMD collections (see references/qmd_setup.md)")
    print("3. Start adding daily notes")


if __name__ == "__main__":
    main()
