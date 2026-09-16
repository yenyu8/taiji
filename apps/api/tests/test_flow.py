from fastapi.testclient import TestClient

from taiji_api import storage
from taiji_api.main import app


def test_pack_flow(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "test.sqlite3")
    client = TestClient(app)
    assert client.get("/health").json()["runner"] == "mock"
    assert client.get("/api/workspace").json()["installed"] is False
    installed = client.post("/api/packs/org.taiji.agent-developer/install")
    assert installed.status_code == 200
    assert installed.json()["pack"]["goal"]["title"] == "学习 Agent 开发"
    run = client.post("/api/run", json={"task_id": "task.tool-function.01",
        "code": "def weather_tool(city):\n    return {'city': city, 'forecast': 'sunny'}"})
    assert run.status_code == 200
    assert run.json()["passed"] == run.json()["total"]
    assert run.json()["evidence"]["result"]["verified"] is False
    workspace = client.get("/api/workspace").json()
    assert len(workspace["evidence"]) == 1
    assert workspace["progress"][0]["status"] == "mock_passed"
    config = client.get("/api/packs/org.taiji.agent-developer/config").json()
    config["goal"]["title"] = "自定义 Agent 目标"
    assert client.put("/api/packs/org.taiji.agent-developer/config", json=config).status_code == 200
    assert client.get("/api/workspace").json()["pack"]["goal"]["title"] == "自定义 Agent 目标"


def test_untrusted_pack_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "test.sqlite3")
    client = TestClient(app)
    assert client.post("/api/packs/untrusted/install").status_code == 404
