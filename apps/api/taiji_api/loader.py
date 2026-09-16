"""Read declarations only. Never import or execute code from a pack."""
import json
from pathlib import Path

import yaml
from jsonschema import validate

from .models import Pack

ROOT = Path(__file__).resolve().parents[3]
MODS = ROOT / "mods"
SCHEMA = ROOT / "packages" / "core-schemas" / "mod-manifest.schema.json"


def official_pack_dirs() -> list[Path]:
    return sorted(folder for folder in MODS.iterdir() if folder.is_dir() and (folder / "manifest.yaml").is_file())


def available_pack_ids() -> list[str]:
    return [yaml.safe_load((folder / "manifest.yaml").read_text(encoding="utf-8"))["id"]
            for folder in official_pack_dirs()]


def load_pack(pack_id: str) -> Pack:
    # Resolve only manifests shipped inside this repository. Arbitrary paths/third-party code are never loaded.
    matching = [(folder, yaml.safe_load((folder / "manifest.yaml").read_text(encoding="utf-8")))
                for folder in official_pack_dirs()]
    match = next(((folder, data) for folder, data in matching if data.get("id") == pack_id), None)
    if match is None:
        raise ValueError("Unknown or untrusted pack")
    folder, manifest_data = match
    validate(manifest_data, json.loads(SCHEMA.read_text(encoding="utf-8")))
    plan_data = yaml.safe_load((folder / manifest_data["entrypoints"]["plan"]).read_text(encoding="utf-8"))
    pack = Pack(manifest=manifest_data, **plan_data)
    if pack.manifest.id != pack_id:
        raise ValueError("Pack ID mismatch")
    skills = {item.id for item in pack.skills}
    scenes = {item.id for item in pack.scenes}
    components = {item.id for item in pack.components}
    if any(task.skill_id not in skills or task.scene_id not in scenes for task in pack.tasks):
        raise ValueError("Invalid task reference")
    if any(not set(scene.component_ids) <= components for scene in pack.scenes):
        raise ValueError("Invalid component reference")
    if not set(pack.manifest.required_components) <= components:
        raise ValueError("Missing required component")
    return pack
