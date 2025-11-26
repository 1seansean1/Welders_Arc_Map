#!/usr/bin/env python3
"""
Architecture Generator for CLAUDE.md

Scans the codebase and auto-generates the Module Architecture section
to prevent documentation drift from actual code structure.

Usage:
    python scripts/generate_architecture.py           # Print to stdout
    python scripts/generate_architecture.py --update  # Update CLAUDE.md in-place

Generated section can be copy-pasted or auto-inserted into CLAUDE.md
"""

import os
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Project root (parent of scripts directory)
PROJECT_ROOT = Path(__file__).parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
BACKEND_DIR = PROJECT_ROOT / "backend"
CLAUDE_MD = PROJECT_ROOT / "CLAUDE.md"


def count_lines(file_path: Path) -> int:
    """Count non-empty, non-comment lines in a file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        count = 0
        in_block_comment = False
        for line in lines:
            stripped = line.strip()
            # Skip empty lines
            if not stripped:
                continue
            # Handle block comments
            if "/*" in stripped:
                in_block_comment = True
            if in_block_comment:
                if "*/" in stripped:
                    in_block_comment = False
                continue
            # Skip single-line comments
            if stripped.startswith("//") or stripped.startswith("#"):
                continue
            count += 1
        return count
    except Exception:
        return 0


def extract_exports(file_path: Path) -> list[str]:
    """Extract exported functions/classes from a JS file."""
    exports = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Match: export function name, export const name, export class name
        patterns = [
            r"export\s+function\s+(\w+)",
            r"export\s+const\s+(\w+)",
            r"export\s+class\s+(\w+)",
            r"export\s+default\s+(?:function\s+)?(\w+)",
            r"export\s+\{\s*([^}]+)\s*\}",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                if isinstance(match, str):
                    # Handle "export { a, b, c }"
                    if "," in match:
                        exports.extend([m.strip().split(" ")[0] for m in match.split(",")])
                    else:
                        exports.append(match.strip())
    except Exception:
        pass
    return exports


def extract_imports(file_path: Path) -> list[str]:
    """Extract import paths from a JS file."""
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Match: import ... from './path.js'
        pattern = r"from\s+['\"]([^'\"]+)['\"]"
        matches = re.findall(pattern, content)
        imports = [m for m in matches if m.startswith(".")]
    except Exception:
        pass
    return imports


def get_module_description(file_path: Path) -> str:
    """Extract first JSDoc comment or infer from filename."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Look for JSDoc at start of file
        match = re.search(r"/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*)", content)
        if match:
            return match.group(1).strip()
    except Exception:
        pass

    # Infer from filename
    name = file_path.stem
    descriptions = {
        "logger": "UILogger class, dual logging",
        "time": "Time formatting utilities",
        "geometry": "FOV calculations, coordinates",
        "validation": "Input validation, XSS protection",
        "eventBus": "Pub/sub for decoupled communication",
        "uiState": "Panel, mobile, active section state",
        "sensorState": "Sensor data + CRUD state",
        "satelliteState": "Satellite data + selection",
        "timeState": "Time range + pending changes",
        "sensorCRUD": "Sensor add/edit/delete",
        "satelliteCRUD": "Satellite management",
        "propagation": "SGP4 calculations",
        "websocket": "WebSocket connection manager",
        "controlPanel": "Panel expand/collapse",
        "modals": "Form modals",
        "sensorTable": "Sensor table rendering",
        "satelliteTable": "Satellite table rendering",
        "timeControls": "Time inputs + Flatpickr",
        "logPanel": "Log display + resize",
        "testPanel": "Test UI panel",
        "leaflet": "Leaflet initialization",
        "deckgl": "Deck.gl layer management",
        "interactions": "4-pane resizer, map maximize",
        "diagnostics": "Map diagnostics tools",
        "bootstrap": "Startup sequence",
        "testResults": "Test result display",
        "testRegistry": "Test registration system",
        "automated-tests": "Automated test suite",
        "config": "Configuration constants",
        "app": "Entry point",
    }
    return descriptions.get(name, name)


def scan_frontend_modules() -> dict:
    """Scan static/modules directory and build structure."""
    modules_dir = STATIC_DIR / "modules"
    structure = defaultdict(list)

    if not modules_dir.exists():
        return structure

    for category_dir in sorted(modules_dir.iterdir()):
        if category_dir.is_dir():
            category = category_dir.name
            for js_file in sorted(category_dir.glob("*.js")):
                lines = count_lines(js_file)
                exports = extract_exports(js_file)
                desc = get_module_description(js_file)
                structure[category].append({
                    "name": js_file.name,
                    "lines": lines,
                    "exports": exports,
                    "description": desc,
                })

    # Also scan root static files
    for js_file in sorted(STATIC_DIR.glob("*.js")):
        if js_file.name not in ["app.monolithic.js"]:  # Skip backups
            lines = count_lines(js_file)
            desc = get_module_description(js_file)
            structure["root"].append({
                "name": js_file.name,
                "lines": lines,
                "description": desc,
            })

    return structure


def scan_backend() -> list[dict]:
    """Scan backend Python files."""
    files = []
    if not BACKEND_DIR.exists():
        return files

    for py_file in sorted(BACKEND_DIR.glob("*.py")):
        if py_file.name.startswith("__"):
            continue
        lines = count_lines(py_file)
        files.append({
            "name": py_file.name,
            "lines": lines,
        })

    return files


def scan_tests() -> list[dict]:
    """Scan test HTML files."""
    tests = []
    for test_file in sorted(STATIC_DIR.glob("test-*.html")):
        # Count test assertions in the file
        try:
            with open(test_file, "r", encoding="utf-8") as f:
                content = f.read()
            # Count assertTrue, assertEquals calls
            assertions = len(re.findall(r"(assertTrue|assertEquals|assertThrows)\(", content))
            tests.append({
                "name": test_file.name,
                "assertions": assertions,
                "url": f"/static/{test_file.name}",
            })
        except Exception:
            pass

    return tests


def generate_tree_diagram(structure: dict) -> str:
    """Generate ASCII tree diagram of module structure."""
    lines = ["static/"]

    # Root files first
    root_files = structure.get("root", [])
    for i, f in enumerate(root_files):
        prefix = "+-- " if i < len(root_files) - 1 or structure else "+-- "
        lines.append(f"{prefix}{f['name']:<26} # {f['description']}")

    if "root" in structure:
        del structure["root"]

    # Modules directory
    if structure:
        lines.append("+-- modules/")
        categories = list(structure.keys())
        for cat_idx, category in enumerate(categories):
            is_last_cat = cat_idx == len(categories) - 1
            cat_prefix = "    +-- "
            lines.append(f"{cat_prefix}{category}/")

            files = structure[category]
            for file_idx, f in enumerate(files):
                is_last_file = file_idx == len(files) - 1
                if is_last_cat:
                    file_prefix = "        +-- "
                else:
                    file_prefix = "    |   +-- "
                lines.append(f"{file_prefix}{f['name']:<18} # {f['description']}")

    return "\n".join(lines)


def generate_dependency_hierarchy() -> str:
    """Generate module dependency hierarchy."""
    return """utils/ (no dependencies)
  |
  v
events/ (no dependencies)
  |
  v
state/ (depends on: utils, events)
  |
  v
data/ (depends on: state, utils)
  |
  v
ui/ (depends on: state, data, utils)
  |
  v
map/ (depends on: state, data)
  |
  v
init/bootstrap (depends on: everything)"""


def generate_stats(structure: dict, backend: list, tests: list) -> str:
    """Generate codebase statistics."""
    total_js_lines = 0
    total_js_files = 0

    for category, files in structure.items():
        for f in files:
            total_js_lines += f.get("lines", 0)
            total_js_files += 1

    total_py_lines = sum(f["lines"] for f in backend)
    total_py_files = len(backend)
    total_test_assertions = sum(t["assertions"] for t in tests)

    return f"""| Metric | Count |
|--------|-------|
| Frontend JS files | {total_js_files} |
| Frontend JS lines | {total_js_lines:,} |
| Backend Python files | {total_py_files} |
| Backend Python lines | {total_py_lines:,} |
| Test files | {len(tests)} |
| Test assertions | {total_test_assertions} |"""


def generate_test_coverage_section(tests: list) -> str:
    """Generate test coverage targets section."""
    test_list = "\n".join([
        f"# {t['url']:<45} ({t['assertions']} assertions)"
        for t in tests
    ])

    return f"""### Test Coverage Targets

| Module Category | Current | Target | Priority |
|-----------------|---------|--------|----------|
| utils/ (logger, time, geometry, validation) | 90%+ | 95% | High |
| state/ (uiState, sensorState, satelliteState, timeState) | 70% | 90% | High |
| events/ (eventBus) | 80% | 95% | Medium |
| data/ (CRUD, propagation, websocket) | 50% | 80% | Medium |
| ui/ (panels, tables, modals) | 30% | 70% | Low |
| map/ (leaflet, deckgl, interactions) | 20% | 60% | Low |

**Test Files:**
```bash
# Start server first, then open in browser:
{test_list}
```

**Coverage Measurement:**
Coverage is calculated by counting tested exports vs total exports per module.
Run all test suites and check browser console for detailed results."""


def generate_architecture_section() -> str:
    """Generate the complete architecture section for CLAUDE.md."""
    structure = scan_frontend_modules()
    backend = scan_backend()
    tests = scan_tests()

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    tree = generate_tree_diagram(dict(structure))  # Copy to avoid mutation
    hierarchy = generate_dependency_hierarchy()
    stats = generate_stats(structure, backend, tests)
    test_section = generate_test_coverage_section(tests)

    return f"""<!-- AUTO-GENERATED: Do not edit manually. Run: python scripts/generate_architecture.py --update -->
<!-- Last generated: {timestamp} -->

### Module Architecture

```
{tree}
```

### Module Dependency Hierarchy

```
{hierarchy}
```

### Codebase Statistics

{stats}

{test_section}

<!-- END AUTO-GENERATED -->"""


def update_claude_md(content: str) -> bool:
    """Update CLAUDE.md with new architecture section."""
    if not CLAUDE_MD.exists():
        print(f"Error: {CLAUDE_MD} not found", file=sys.stderr)
        return False

    with open(CLAUDE_MD, "r", encoding="utf-8") as f:
        claude_content = f.read()

    # Find and replace auto-generated section
    pattern = r"<!-- AUTO-GENERATED: Do not edit manually\..*?<!-- END AUTO-GENERATED -->"

    if re.search(pattern, claude_content, re.DOTALL):
        # Replace existing section
        new_content = re.sub(pattern, content, claude_content, flags=re.DOTALL)
    else:
        # Insert after "### Module Architecture" or before "### Module Dependency Hierarchy"
        insert_marker = "### Module Architecture"
        if insert_marker in claude_content:
            # Find the end of the existing section (next ## or ### heading)
            parts = claude_content.split(insert_marker)
            if len(parts) == 2:
                # Find next major heading
                rest = parts[1]
                next_section = re.search(r"\n(## \d+\.|### Performance Targets)", rest)
                if next_section:
                    insert_pos = next_section.start()
                    new_content = (
                        parts[0] +
                        insert_marker +
                        "\n\n" + content + "\n\n" +
                        rest[insert_pos:]
                    )
                else:
                    new_content = parts[0] + insert_marker + "\n\n" + content + "\n" + rest
            else:
                print("Warning: Could not find insertion point", file=sys.stderr)
                return False
        else:
            print("Warning: '### Module Architecture' not found in CLAUDE.md", file=sys.stderr)
            return False

    with open(CLAUDE_MD, "w", encoding="utf-8") as f:
        f.write(new_content)

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate architecture documentation from codebase"
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update CLAUDE.md in-place instead of printing to stdout"
    )
    args = parser.parse_args()

    content = generate_architecture_section()

    if args.update:
        if update_claude_md(content):
            print(f"Updated {CLAUDE_MD}")
        else:
            print("Failed to update CLAUDE.md", file=sys.stderr)
            sys.exit(1)
    else:
        # Handle Windows console encoding issues
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        print(content)


if __name__ == "__main__":
    main()
