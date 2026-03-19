#!/usr/bin/env python3
"""
Apply memory decay and regenerate entity summaries.

Sorts facts into tiers:
- Hot (accessed last 7 days)
- Warm (accessed 8-30 days ago)
- Cold (not accessed 30+ days) - omitted from summary

After regenerating summaries, updates QMD search index and embeddings.

Usage: python weekly_synthesis.py [base_path] [--skip-qmd]
If base_path is not provided, uses PARA_MEMORY_ROOT environment variable.
If environment variable not set, defaults to ~/para-memory/knowledge.
"""

import sys
import subprocess
from pathlib import Path
import json
from datetime import datetime


def days_since_access(last_accessed):
    """Calculate days since last access."""
    if not last_accessed:
        return 999  # Very old

    try:
        last_date = datetime.strptime(last_accessed, "%Y-%m-%d")
        return (datetime.now() - last_date).days
    except (ValueError, TypeError):
        return 999


def classify_fact(fact):
    """Classify fact as hot, warm, or cold."""
    days = days_since_access(fact.get("lastAccessed"))
    access_count = fact.get("accessCount", 0)

    # Frequency resistance: high access count extends warmth
    if access_count > 10:
        days = max(0, days - 5)  # Bonus 5 days

    if days <= 7:
        return "hot"
    elif days <= 30:
        return "warm"
    else:
        return "cold"


def get_base_path(provided_path=None):
    """Get base path from argument, environment variable, or default."""
    import os
    from pathlib import Path
    
    if provided_path:
        return Path(os.path.expanduser(provided_path))
    
    env_path = os.environ.get('PARA_MEMORY_ROOT')
    if env_path:
        return Path(os.path.expanduser(env_path))
    
    # Default path
    return Path(os.path.expanduser('~/para-memory/knowledge'))


def regenerate_summary(entity_path):
    """Regenerate summary.md from items.json with memory decay."""
    items_path = entity_path / "items.json"
    summary_path = entity_path / "summary.md"

    if not items_path.exists():
        return 0, 0, 0

    data = json.loads(items_path.read_text())
    active_facts = [f for f in data["items"] if f.get("status") == "active"]

    # Classify facts
    hot_facts = []
    warm_facts = []
    cold_facts = []

    for fact in active_facts:
        tier = classify_fact(fact)
        if tier == "hot":
            hot_facts.append(fact)
        elif tier == "warm":
            warm_facts.append(fact)
        else:
            cold_facts.append(fact)

    # Sort by access count within tiers
    hot_facts.sort(key=lambda f: f.get("accessCount", 0), reverse=True)
    warm_facts.sort(key=lambda f: f.get("accessCount", 0), reverse=True)

    # Read existing summary to preserve overview
    overview = ""
    if summary_path.exists():
        content = summary_path.read_text()
        if "## Overview" in content:
            parts = content.split("## Hot Facts", 1)
            if len(parts) > 0:
                overview = parts[0].strip()

    # Generate new summary
    entity_name = entity_path.name.replace("-", " ").title()
    summary_content = overview if overview else f"# {entity_name}\n\n## Overview\n\n"

    summary_content += "\n## Hot Facts\n\n"
    if hot_facts:
        for fact in hot_facts:
            summary_content += f"- {fact['fact']} ({fact.get('timestamp', 'unknown')})\n"
    else:
        summary_content += "*No recently accessed facts*\n"

    summary_content += "\n## Warm Facts\n\n"
    if warm_facts:
        for fact in warm_facts:
            summary_content += f"- {fact['fact']} ({fact.get('timestamp', 'unknown')})\n"
    else:
        summary_content += "*No warm facts*\n"

    # Note cold facts exist but don't list them
    if cold_facts:
        summary_content += f"\n## Archived Facts\n\n*{len(cold_facts)} cold facts available in items.json*\n"

    # Related entities
    all_related = set()
    for fact in active_facts:
        all_related.update(fact.get("relatedEntities", []))

    if all_related:
        summary_content += "\n## Related Entities\n\n"
        for entity in sorted(all_related):
            summary_content += f"- {entity}\n"

    summary_path.write_text(summary_content)
    return len(hot_facts), len(warm_facts), len(cold_facts)


def update_qmd_index():
    """Update QMD search index and embeddings."""
    print("\nUpdating QMD search index...")

    try:
        # Update index
        result = subprocess.run(
            ["qmd", "update"],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0:
            print("  ✓ QMD index updated")
        else:
            print(f"  ⚠ QMD update warning: {result.stderr}")
    except FileNotFoundError:
        print("  ⚠ QMD not found - skipping index update")
        print("    Install QMD: bun install -g github:tobi/qmd")
        return False
    except subprocess.TimeoutExpired:
        print("  ⚠ QMD update timed out")
        return False
    except Exception as e:
        print(f"  ⚠ QMD update error: {e}")
        return False

    # Update embeddings
    print("Rebuilding vector embeddings...")
    try:
        result = subprocess.run(
            ["qmd", "embed"],
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode == 0:
            print("  ✓ Vector embeddings rebuilt")
        else:
            print(f"  ⚠ QMD embedding warning: {result.stderr}")
    except subprocess.TimeoutExpired:
        print("  ⚠ QMD embedding rebuild timed out")
        return False
    except Exception as e:
        print(f"  ⚠ QMD embedding error: {e}")
        return False

    return True


def main():
    skip_qmd = "--skip-qmd" in sys.argv
    args = [arg for arg in sys.argv[1:] if arg != "--skip-qmd"]

    # Handle 0 or 1 arguments
    if len(args) > 1:
        print("Usage: python weekly_synthesis.py [base_path] [--skip-qmd]")
        print("If base_path is not provided, uses PARA_MEMORY_ROOT environment variable.")
        print("If environment variable not set, defaults to ~/para-memory/knowledge.")
        sys.exit(1)
    
    base_path_arg = args[0] if len(args) == 1 else None
    base_path = get_base_path(base_path_arg)

    if not base_path.exists():
        print(f"Error: Path not found: {base_path}")
        sys.exit(1)

    print("Running weekly synthesis...")

    # Find all entity directories (those with items.json)
    entity_paths = []
    for items_file in base_path.rglob("items.json"):
        entity_paths.append(items_file.parent)

    total_hot = total_warm = total_cold = 0

    for entity_path in entity_paths:
        hot, warm, cold = regenerate_summary(entity_path)
        total_hot += hot
        total_warm += warm
        total_cold += cold
        print(f"  ✓ {entity_path.name}: {hot} hot, {warm} warm, {cold} cold")

    print(f"\n✓ Synthesis complete!")
    print(f"  Total: {total_hot} hot, {total_warm} warm, {total_cold} cold facts")
    print(f"  Processed {len(entity_paths)} entities")

    # Update QMD index unless skipped
    if not skip_qmd:
        update_qmd_index()
    else:
        print("\n⚠ Skipped QMD update (--skip-qmd flag)")


if __name__ == "__main__":
    main()
