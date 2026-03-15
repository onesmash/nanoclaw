#!/usr/bin/env python3
"""
Add or update facts in an entity's items.json.

Usage: python update_entity.py <entity_path> --add <fact_json>
       python update_entity.py <entity_path> --supersede <old_fact_id> <new_fact_json>
"""

import sys
import json
from pathlib import Path
from datetime import datetime
import argparse


def generate_fact_id(entity_path):
    """Generate unique fact ID."""
    items_path = Path(entity_path) / "items.json"
    data = json.loads(items_path.read_text())

    # Find highest existing ID number
    max_id = 0
    for item in data["items"]:
        if "id" in item:
            try:
                num = int(item["id"].split("-")[-1])
                max_id = max(max_id, num)
            except (ValueError, IndexError):
                pass

    entity_name = Path(entity_path).name
    return f"{entity_name}-{max_id + 1:03d}"


def add_fact(entity_path, fact_data):
    """Add a new fact to items.json."""
    items_path = Path(entity_path) / "items.json"

    if not items_path.exists():
        print(f"Error: items.json not found at {items_path}")
        sys.exit(1)

    data = json.loads(items_path.read_text())

    # Generate ID if not provided
    if "id" not in fact_data:
        fact_data["id"] = generate_fact_id(entity_path)

    # Set defaults
    fact_data.setdefault("status", "active")
    fact_data.setdefault("supersededBy", None)
    fact_data.setdefault("relatedEntities", [])
    fact_data.setdefault("lastAccessed", datetime.now().strftime("%Y-%m-%d"))
    fact_data.setdefault("accessCount", 0)

    # Validate required fields
    required = ["fact", "category", "timestamp", "source"]
    missing = [f for f in required if f not in fact_data]
    if missing:
        print(f"Error: Missing required fields: {', '.join(missing)}")
        sys.exit(1)

    # Add fact
    data["items"].append(fact_data)
    data["lastModified"] = datetime.now().isoformat()

    # Save
    items_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"✓ Added fact: {fact_data['id']}")
    return fact_data["id"]


def supersede_fact(entity_path, old_fact_id, new_fact_data):
    """Mark a fact as superseded and add a new one."""
    items_path = Path(entity_path) / "items.json"

    if not items_path.exists():
        print(f"Error: items.json not found at {items_path}")
        sys.exit(1)

    data = json.loads(items_path.read_text())

    # Find old fact
    old_fact = None
    for item in data["items"]:
        if item.get("id") == old_fact_id:
            old_fact = item
            break

    if not old_fact:
        print(f"Error: Fact {old_fact_id} not found")
        sys.exit(1)

    # Add new fact
    new_id = add_fact(entity_path, new_fact_data)

    # Reload data after adding new fact
    data = json.loads(items_path.read_text())

    # Update old fact
    for item in data["items"]:
        if item.get("id") == old_fact_id:
            item["status"] = "superseded"
            item["supersededBy"] = new_id
            break

    data["lastModified"] = datetime.now().isoformat()
    items_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(f"✓ Superseded fact: {old_fact_id} → {new_id}")


def main():
    parser = argparse.ArgumentParser(description="Add or update facts in entity")
    parser.add_argument("entity_path", help="Path to entity directory")
    parser.add_argument("--add", help="Add new fact (JSON string)")
    parser.add_argument("--supersede", nargs=2, metavar=("OLD_ID", "NEW_FACT"),
                        help="Supersede old fact with new one")

    args = parser.parse_args()

    if args.add:
        fact_data = json.loads(args.add)
        add_fact(args.entity_path, fact_data)
    elif args.supersede:
        old_id, new_fact_json = args.supersede
        new_fact_data = json.loads(new_fact_json)
        supersede_fact(args.entity_path, old_id, new_fact_data)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
