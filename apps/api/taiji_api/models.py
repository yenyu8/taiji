from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Goal(BaseModel):
    id: str
    title: str
    description: str
    success_criteria: str


class Skill(BaseModel):
    id: str
    title: str
    description: str
    prerequisites: list[str] = Field(default_factory=list)


class Task(BaseModel):
    id: str
    title: str
    description: str
    skill_id: str
    scene_id: str
    starter_code: str
    checks: list[dict[str, Any]] = Field(min_length=1)


class Component(BaseModel):
    id: str
    title: str
    kind: str


class Scene(BaseModel):
    id: str
    title: str
    component_ids: list[str]


class Evidence(BaseModel):
    id: str
    schema_version: str = "0.1.0"
    type: str
    task_id: str
    skill_id: str
    result: dict[str, Any]
    created_at: datetime
    source: str


class Progress(BaseModel):
    skill_id: str
    status: Literal["not_started", "practicing", "mock_passed"]
    evidence_ids: list[str] = Field(default_factory=list)


class Manifest(BaseModel):
    id: str
    name: str
    version: str
    kind: Literal["learning-pack"]
    core_api: str
    license: str
    permissions: list[str] = Field(default_factory=list)
    required_components: list[str]
    entrypoints: dict[str, str]


class Pack(BaseModel):
    manifest: Manifest
    goal: Goal
    skills: list[Skill] = Field(min_length=1)
    tasks: list[Task] = Field(min_length=1)
    scenes: list[Scene] = Field(min_length=1)
    components: list[Component] = Field(min_length=1)


class RunRequest(BaseModel):
    task_id: str
    code: str = Field(max_length=20000)
    hint_level: int = Field(default=0, ge=0, le=5)


class RunResult(BaseModel):
    mode: Literal["mock"] = "mock"
    passed: int
    total: int
    checks: list[dict[str, Any]]
    message: str
    evidence: Evidence
    progress: Progress
