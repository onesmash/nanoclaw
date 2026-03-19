#!/usr/bin/env python3
"""
Create a new entity in the knowledge graph.

Usage: python create_entity.py [base_path] <category> <name>
Category: projects, people, companies, resources

If base_path is not provided, uses PARA_MEMORY_ROOT environment variable.
If environment variable not set, defaults to ~/para-memory/knowledge.
"""

import sys
import os
from pathlib import Path
import json
from datetime import datetime


def generate_entity_id(category, name):
    """Generate a unique entity ID."""
    # Simple ID generation - timestamp-based
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    clean_name = name.lower().replace(" ", "-")
    return f"{category}-{clean_name}-{timestamp}"


def create_summary(name, category):
    """Create summary.md template."""
    return f"""# {name}

## Overview

<!-- Brief description of this entity -->

## Hot Facts

<!-- Recently accessed facts (last 7 days) -->

## Warm Facts

<!-- Moderately recent facts (8-30 days) -->

## Related Entities

<!-- Links to related entities -->
"""


def create_items_json(entity_id):
    """Create initial items.json with empty array."""
    return {
        "entityId": entity_id,
        "created": datetime.now().isoformat(),
        "lastModified": datetime.now().isoformat(),
        "items": []
    }


def get_default_base_path():
    """Get base path from environment variable or default."""
    para_root = os.environ.get('PARA_MEMORY_ROOT', "~/para-memory")
    return os.path.expanduser(os.path.join(para_root, "knowledge"))

def main():
    # Handle 2 or 3 arguments
    if len(sys.argv) != 3 and len(sys.argv) != 4:
        print("Usage: python create_entity.py [base_path] <category> <name>")
        print("Category: projects, people, companies, resources")
        print("\nIf base_path is not provided, uses PARA_MEMORY_ROOT environment variable.")
        print("If environment variable not set, defaults to ~/para-memory/knowledge.")
        sys.exit(1)
    
    if len(sys.argv) == 3:
        # No base_path provided, use environment variable/default
        base_path = None
        category = sys.argv[1]
        name = sys.argv[2]
    else:
        # base_path provided as first argument
        base_path = sys.argv[1]
        category = sys.argv[2]
        name = sys.argv[3]
    
    # Get resolved base path
    base_path = base_path if base_path else get_default_base_path()
    base_path = Path(base_path)  # Convert to Path object

    # Validate category
    valid_categories = {
        "projects": "projects",
        "people": "areas/people",
        "companies": "areas/companies",
        "resources": "resources"
    }

    if category not in valid_categories:
        print(f"Error: Invalid category. Must be one of: {', '.join(valid_categories.keys())}")
        sys.exit(1)

    # Create entity directory
    category_path = valid_categories[category]
    clean_name = name.lower().replace(" ", "-")
    entity_path = base_path / category_path / clean_name

    summary_file = entity_path / "summary.md"
    items_file = entity_path / "items.json"
    
    # Check if entity exists and is complete
    if entity_path.exists():
        # Check if directory is incomplete (missing required files)
        missing_files = []
        if not summary_file.exists():
            missing_files.append("summary.md")
        if not items_file.exists():
            missing_files.append("items.json")
        
        if missing_files:
            # Directory exists but is incomplete - initialize missing files
            print(f"⚠️  Entity directory exists but is incomplete at {entity_path}")
            print(f"   Missing files: {', '.join(missing_files)}")
            print(f"   Initializing missing files...")
        else:
            # Directory is complete - refuse to overwrite
            print(f"Error: Entity already exists and is complete at {entity_path}")
            print(f"   Use update_entity.py to modify existing entity")
            sys.exit(1)
    else:
        # Create new directory
        entity_path.mkdir(parents=True, exist_ok=True)

    # Create or update summary.md if missing
    if not summary_file.exists():
        summary_content = create_summary(name, category)
        summary_file.write_text(summary_content)

    # Create or update items.json if missing
    if not items_file.exists():
        entity_id = generate_entity_id(category, name)
        items_data = create_items_json(entity_id)
        items_file.write_text(json.dumps(items_data, indent=2, ensure_ascii=False))

    print(f"✓ Created entity: {name}")
    print(f"  Location: {entity_path}")
    print(f"\nNext steps:")
    print(f"1. Edit {entity_path}/summary.md to add overview")
    print(f"2. Use update_entity.py to add facts")


if __name__ == "__main__":
    main()
