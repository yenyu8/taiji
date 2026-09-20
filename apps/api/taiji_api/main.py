from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .loader import available_pack_ids, load_pack
from .models import Evidence, Pack, RunRequest, RunResult
from .ai import router as ai_router
from .storage import get_override, install, is_installed, list_evidence, progress_for, save_evidence, set_override

PACK_ID = available_pack_ids()[0]
app = FastAPI(title="Taiji Core API", version="0.1.0")
app.include_router(ai_router)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]", "testserver", "api"])


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Never reflect a model connection's SecretStr input or credentials in validation responses.
    return JSONResponse(status_code=422, content={"detail": "提交的数据格式不正确，请检查必填字段、地址和长度。",
        "fields": [".".join(str(v) for v in error["loc"]) for error in exc.errors()]})


@app.middleware("http")
async def protect_model_requests(request: Request, call_next):
    if request.url.path.startswith("/api/ai/"):
        origin = request.headers.get("origin")
        if origin and origin not in {"http://localhost:3000", "http://127.0.0.1:3000"}:
            return JSONResponse(status_code=403, content={"detail": "不允许此页面调用模型接口。"})
    return await call_next(request)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["GET", "POST", "PUT"], allow_headers=["Content-Type"])


def active_pack() -> Pack:
    original = load_pack(PACK_ID)
    override = get_override(PACK_ID)
    return Pack(manifest=original.manifest, **override) if override else original


@app.get("/health")
def health():
    return {"status": "ok", "runner": "mock"}


@app.get("/api/packs")
def packs():
    return [{"manifest": load_pack(pack_id).manifest, "installed": is_installed(pack_id)}
            for pack_id in available_pack_ids()]


@app.post("/api/packs/{pack_id}/install")
def install_pack(pack_id: str):
    try:
        pack = load_pack(pack_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    install(pack_id, datetime.now(timezone.utc).isoformat())
    return {"installed": True, "pack": pack}


@app.get("/api/workspace")
def workspace():
    pack = active_pack()
    if not is_installed(PACK_ID):
        return {"installed": False, "pack": None, "evidence": [], "progress": []}
    return {"installed": True, "pack": pack, "evidence": list_evidence(),
            "progress": [progress_for(skill.id) for skill in pack.skills]}


@app.get("/api/packs/{pack_id}/config")
def get_config(pack_id: str):
    if pack_id != PACK_ID:
        raise HTTPException(404, "Pack not found")
    return active_pack().model_dump(exclude={"manifest"})


@app.put("/api/packs/{pack_id}/config")
def put_config(pack_id: str, plan: dict):
    if pack_id != PACK_ID or not is_installed(PACK_ID):
        raise HTTPException(404, "Installed pack not found")
    if set(plan) != {"goal", "skills", "tasks", "scenes", "components"}:
        raise HTTPException(422, "Only plan fields are editable")
    try:
        candidate = Pack(manifest=load_pack(PACK_ID).manifest, **plan)
    except Exception as exc:
        raise HTTPException(422, f"Invalid plan: {exc}") from exc
    skill_ids = {item.id for item in candidate.skills}
    scene_ids = {item.id for item in candidate.scenes}
    component_ids = {item.id for item in candidate.components}
    if (any(task.skill_id not in skill_ids or task.scene_id not in scene_ids for task in candidate.tasks)
            or any(not set(scene.component_ids) <= component_ids for scene in candidate.scenes)):
        raise HTTPException(422, "Broken references")
    if any(check.get("kind") not in {"text_contains", "tokens_present"}
           or (check.get("kind") == "text_contains" and not isinstance(check.get("value"), str))
           or (check.get("kind") == "tokens_present" and not isinstance(check.get("values"), list))
           for task in candidate.tasks for check in task.checks):
        raise HTTPException(422, "Unsupported mock check")
    set_override(PACK_ID, candidate.model_dump(exclude={"manifest"}))
    return {"saved": True}


@app.post("/api/run", response_model=RunResult)
def run(request: RunRequest):
    if not is_installed(PACK_ID):
        raise HTTPException(400, "Install a pack first")
    pack = active_pack()
    task = next((item for item in pack.tasks if item.id == request.task_id), None)
    if task is None:
        raise HTTPException(404, "Task not found")
    # This service deliberately never executes submitted code. Checks are illustrative only.
    checks = []
    for spec in task.checks:
        if spec["kind"] == "text_contains":
            passed = spec["value"] in request.code
        elif spec["kind"] == "tokens_present":
            passed = all(token in request.code for token in spec["values"])
        else:
            raise HTTPException(422, "Unsupported mock check")
        checks.append({"id": spec["id"], "label": spec["label"], "passed": passed})
    passed_count = sum(bool(check["passed"]) for check in checks)
    evidence = Evidence(id=str(uuid4()), type="mock_test_result", task_id=task.id,
                        skill_id=task.skill_id, created_at=datetime.now(timezone.utc),
                        source="mock-runner", result={"passed": passed_count,
                        "total": len(checks), "hints_used": request.hint_level,
                        "verified": False})
    save_evidence(evidence)
    return RunResult(passed=passed_count, total=len(checks), checks=checks,
                     message="模拟检查完成；代码未执行，结果不代表真实测试通过。",
                     evidence=evidence, progress=progress_for(task.skill_id))
