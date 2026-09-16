"""Local SQLAlchemy store with Alembic migrations and append-only Evidence."""
import json
import os
from functools import lru_cache
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from .models import Evidence, Progress

DB_PATH = Path(os.getenv("TAIJI_DB_PATH", Path(__file__).resolve().parents[1] / "taiji.sqlite3"))


class Base(DeclarativeBase):
    pass


class InstallationRow(Base):
    __tablename__ = "installations"
    pack_id: Mapped[str] = mapped_column(String, primary_key=True)
    installed_at: Mapped[str] = mapped_column(String)


class EvidenceRow(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    schema_version: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    task_id: Mapped[str] = mapped_column(String)
    skill_id: Mapped[str] = mapped_column(String)
    result_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)


class OverrideRow(Base):
    __tablename__ = "pack_overrides"
    pack_id: Mapped[str] = mapped_column(String, primary_key=True)
    plan_json: Mapped[str] = mapped_column(Text)


@lru_cache(maxsize=16)
def engine_for(path: str):
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path.as_posix()}")
    command.upgrade(cfg, "head")
    return create_engine(f"sqlite:///{db_path.as_posix()}")


def session() -> Session:
    return Session(engine_for(str(DB_PATH.resolve())))


def is_installed(pack_id: str) -> bool:
    with session() as db:
        return db.get(InstallationRow, pack_id) is not None


def install(pack_id: str, timestamp: str) -> None:
    with session() as db:
        if db.get(InstallationRow, pack_id) is None:
            db.add(InstallationRow(pack_id=pack_id, installed_at=timestamp))
            db.commit()


def get_override(pack_id: str) -> dict | None:
    with session() as db:
        row = db.get(OverrideRow, pack_id)
        return json.loads(row.plan_json) if row else None


def set_override(pack_id: str, plan: dict) -> None:
    with session() as db:
        row = db.get(OverrideRow, pack_id)
        if row is None:
            db.add(OverrideRow(pack_id=pack_id, plan_json=json.dumps(plan, ensure_ascii=False)))
        else:
            row.plan_json = json.dumps(plan, ensure_ascii=False)
        db.commit()


def save_evidence(evidence: Evidence) -> None:
    with session() as db:
        db.add(EvidenceRow(id=evidence.id, schema_version=evidence.schema_version,
                           type=evidence.type, task_id=evidence.task_id,
                           skill_id=evidence.skill_id, result_json=json.dumps(evidence.result, ensure_ascii=False),
                           created_at=evidence.created_at.isoformat(), source=evidence.source))
        db.commit()


def list_evidence() -> list[Evidence]:
    with session() as db:
        rows = db.scalars(select(EvidenceRow).order_by(EvidenceRow.created_at.desc())).all()
        return [Evidence(id=row.id, schema_version=row.schema_version, type=row.type,
                         task_id=row.task_id, skill_id=row.skill_id, result=json.loads(row.result_json),
                         created_at=row.created_at, source=row.source) for row in rows]


def progress_for(skill_id: str) -> Progress:
    relevant = [item for item in list_evidence() if item.skill_id == skill_id]
    if not relevant:
        status = "not_started"
    elif any(item.result.get("passed") == item.result.get("total") for item in relevant):
        status = "mock_passed"
    else:
        status = "practicing"
    return Progress(skill_id=skill_id, status=status, evidence_ids=[item.id for item in relevant])
