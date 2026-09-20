import json

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from taiji_api.ai import Connection, Roadmap
from taiji_api.main import app

CONFIG = {"base_url": "http://localhost:11434/v1", "model": "test-model", "api_key": "do-not-echo-this-key"}
ROADMAP = {"summary": "工具函数入门", "stages": [{"name": "基础", "stage": "base", "goal": "实现函数"}],
           "nodes": [{"code": "1.1", "title": "函数", "description": "输入到输出", "stage": "base",
                      "est_hours": 1, "difficulty": 1, "prerequisites": []}]}
ROADMAP["nodes"] = [{"code": f"1.{i + 1}", "title": title, "description": "完成明确的小练习", "stage": "base",
    "est_hours": 1, "difficulty": i + 1, "prerequisites": [f"1.{i}"] if i else [],
    "outcome": "独立实现一个函数", "practice": "实现加法函数并调用", "acceptance": "输入2和3，输出5"}
    for i, title in enumerate(["函数参数", "处理异常", "综合自测"])]



@pytest.fixture
def upstream(monkeypatch):
    requests, responses = [], []
    original = httpx.AsyncClient
    async def handler(request):
        requests.append(request)
        return responses.pop(0)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    return requests, responses


def completion(content):
    return httpx.Response(200, json={"choices": [{"message": {"content": content}, "finish_reason": "stop"}]})


def test_live_adapter_models_and_auth(upstream):
    requests, responses = upstream
    responses.extend([httpx.Response(200, json={"data": [{"id": "test-model"}]}), completion("OK")])
    client = TestClient(app)
    assert client.post("/api/ai/models", json=CONFIG).json() == {"models": ["test-model"]}
    result = client.post("/api/ai/test", json=CONFIG)
    assert result.status_code == 200
    assert result.json()["connected"] is True
    assert str(requests[1].url).endswith("/v1/chat/completions")
    assert requests[1].headers["Authorization"] == "Bearer do-not-echo-this-key"
    assert CONFIG["api_key"] not in result.text


def test_roadmap_generated_reviewed_and_validated(upstream):
    requests, responses = upstream
    responses.extend([completion(json.dumps(ROADMAP)), completion(json.dumps({"roadmap": ROADMAP, "changes": ["补充自测"], "concerns": []}))])
    result = TestClient(app).post("/api/ai/roadmap", json={"connection": CONFIG,
        "goal": "实现工具函数", "background": "初学者", "weekly_hours": 5})
    assert result.status_code == 200
    assert len(requests) == 2
    assert result.json()["provenance"]["ai_reviewed"] is True
    assert result.json()["provenance"]["human_reviewed"] is False
    assert CONFIG["api_key"] not in result.text


@pytest.mark.parametrize("prerequisites", [["missing"], ["1.1"]])
def test_roadmap_rejects_missing_and_cyclic_dependencies(prerequisites):
    data = json.loads(json.dumps(ROADMAP))
    data["nodes"][0]["prerequisites"] = prerequisites
    with pytest.raises(ValidationError):
        Roadmap.model_validate(data)


def test_malformed_model_json_does_not_become_a_fake_plan(upstream):
    _, responses = upstream
    responses.extend([completion('not json'), completion('still not json')])
    result = TestClient(app).post("/api/ai/roadmap", json={"connection": CONFIG,
        "goal": "编程", "background": "初学者", "weekly_hours": 5})
    assert result.status_code == 502


def test_selection_and_context_reach_model(upstream):
    requests, responses = upstream
    responses.append(completion("这个函数返回两个数的和。"))
    result = TestClient(app).post("/api/ai/chat", json={"connection": CONFIG,
        "lesson_title": "函数", "lesson_body": "理解函数", "code": "def add(a,b): return a+b",
        "selected_code": "return a+b", "messages": [{"role": "user", "content": "解释这个函数"}]})
    assert result.status_code == 200
    body = json.loads(requests[0].content)
    context = json.loads(body["messages"][1]["content"].split('\n', 1)[1])
    assert context["selected_code"] == "return a+b"
    assert context["full_code"].startswith("def add")


def test_tutorial_code_blocks_are_structured(upstream):
    _, responses = upstream
    tutorial = beginner_fixture()
    responses.append(completion(json.dumps(tutorial)))
    result = TestClient(app).post("/api/ai/lesson", json={"connection": CONFIG,
        "goal": "编程", "title": "函数", "description": "参数", "background": "初学者"})
    assert result.status_code == 200
    assert result.json()["examples"][0]["code"] == "print(42)"


def test_upstream_errors_do_not_leak_secret(upstream):
    _, responses = upstream
    responses.append(httpx.Response(401, text=CONFIG["api_key"]))
    response = TestClient(app).post("/api/ai/test", json=CONFIG)
    assert response.status_code == 401
    assert CONFIG["api_key"] not in response.text
    invalid = {**CONFIG, "base_url": "http://bad.example/?key=" + CONFIG["api_key"]}
    response = TestClient(app).post("/api/ai/test", json=invalid)
    assert response.status_code == 422
    assert CONFIG["api_key"] not in response.text


def test_sandbox_origin_cannot_access_model_proxy():
    response = TestClient(app).post("/api/ai/test", json=CONFIG, headers={"Origin": "null"})
    assert response.status_code == 403


def test_url_normalizes_pasted_endpoint():
    c = Connection(base_url="https://model.example/v1/chat/completions")
    assert c.base_url == "https://model.example/v1"


def test_compatible_token_parameter_fallback(upstream):
    requests, responses = upstream
    responses.extend([httpx.Response(400, json={"error": {"param": "max_tokens", "code": "unsupported_parameter"}}), completion("OK")])
    result = TestClient(app).post("/api/ai/test", json=CONFIG)
    assert result.status_code == 200
    payload = json.loads(requests[1].content)
    assert "max_tokens" not in payload
    assert payload["max_completion_tokens"] == 512


def test_bad_draft_is_repaired_once(upstream):
    requests, responses = upstream
    responses.extend([completion('not json'), completion(json.dumps(ROADMAP)),
        completion(json.dumps({"roadmap": ROADMAP, "changes": [], "concerns": []}))])
    result = TestClient(app).post('/api/ai/roadmap', json={"connection": CONFIG, "goal": "函数", "background": "零基础", "weekly_hours": 3, "repair": True})
    assert result.status_code == 200
    assert len(requests) == 3
    assert result.json()['quality']['auto_repaired'] is True
    assert result.json()['quality']['total_hours'] == 3
    assert result.json()['quality']['estimated_weeks'] == 1


def test_review_failure_preserves_checked_draft(upstream):
    _, responses = upstream
    responses.extend([completion(json.dumps(ROADMAP)), httpx.Response(429)])
    result = TestClient(app).post('/api/ai/roadmap', json={"connection": CONFIG, "goal": "函数", "background": "零基础", "weekly_hours": 3})
    assert result.status_code == 200
    assert result.json()['provenance']['ai_reviewed'] is False
    assert result.json()['quality']['concerns']
    assert result.json()['roadmap']['nodes'][0]['acceptance']


def test_nonstandard_models_list_is_actionable(upstream):
    _, responses = upstream
    responses.append(httpx.Response(200, json={"data": None}))
    response = TestClient(app).post('/api/ai/models', json=CONFIG)
    assert response.status_code == 502
    assert '高级设置' in response.json()['detail']


def test_quality_gate_rejects_empty_practice_and_forward_dependency():
    from taiji_api.ai import check_generated_plan
    data = json.loads(json.dumps(ROADMAP))
    data['nodes'][0]['practice'] = ''
    with pytest.raises(ValueError, match='实践任务'):
        check_generated_plan(Roadmap.model_validate(data))
    data = json.loads(json.dumps(ROADMAP))
    data['nodes'].reverse()
    with pytest.raises(ValueError, match='前置节点'):
        check_generated_plan(Roadmap.model_validate(data))


def test_refinement_uses_existing_roadmap_and_user_feedback(upstream):
    requests, responses = upstream
    responses.extend([completion(json.dumps(ROADMAP))])
    result = TestClient(app).post('/api/ai/roadmap', json={"connection": CONFIG, "goal": "函数", "background": "零基础", "weekly_hours": 3,
        "audit": False, "current_roadmap": ROADMAP, "revision": "多练习", "preferences": "每次一小时"})
    assert result.status_code == 200
    profile = json.loads(json.loads(requests[0].content)['messages'][1]['content'])
    assert profile['revision'] == '多练习'
    assert profile['current_roadmap']['nodes']


def test_default_invalid_draft_does_not_retry(upstream):
    requests, responses = upstream
    responses.append(completion('bad json'))
    result = TestClient(app).post('/api/ai/roadmap', json={"connection": CONFIG, "goal": "函数", "background": "零基础", "weekly_hours": 3})
    assert result.status_code == 502
    assert len(requests) == 1


def test_upstream_budget_includes_compatibility_retry(upstream):
    requests, responses = upstream
    responses.extend([httpx.Response(400, json={"error": {"param": "max_tokens", "code": "unsupported_parameter"}}), completion(json.dumps(ROADMAP))])
    result = TestClient(app).post('/api/ai/roadmap', json={"connection": CONFIG, "goal": "函数", "background": "零基础", "weekly_hours": 3})
    assert result.status_code == 200
    assert len(requests) == 2
    assert result.json()['provenance']['ai_reviewed'] is False


def test_cancel_timeout_and_duplicate_cleanup(monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from taiji_api import ai
    async def scenario():
        stopped = asyncio.Event()
        async def slow(request, job):
            try:
                await asyncio.sleep(30)
            finally:
                stopped.set()
        class Connected:
            async def is_disconnected(self): return False
        monkeypatch.setattr(ai, 'build_roadmap', slow)
        request = ai.RoadmapRequest(connection=CONFIG, goal='函数', background='零基础', weekly_hours=3, request_id='12345678-1234-1234-1234-123456789abc')
        first = asyncio.create_task(ai.generate_roadmap(request, Connected()))
        await asyncio.sleep(0.01)
        status = await ai.roadmap_status(request.request_id)
        assert status['limit'] == 2
        with pytest.raises(HTTPException) as duplicate:
            await ai.generate_roadmap(request, Connected())
        assert duplicate.value.status_code == 409
        await ai.cancel_roadmap(request.request_id)
        with pytest.raises(HTTPException) as cancelled:
            await first
        assert cancelled.value.status_code == 499
        assert stopped.is_set() and not ai.ROADMAP_JOBS and not ai.ACTIVE_CONNECTIONS
        monkeypatch.setattr(ai, 'ROADMAP_TIMEOUT', 0.02)
        with pytest.raises(HTTPException) as timeout:
            await ai.generate_roadmap(request, Connected())
        assert timeout.value.status_code == 504
        assert not ai.ROADMAP_JOBS and not ai.ACTIVE_CONNECTIONS
    asyncio.run(scenario())


def beginner_fixture():
    example = {"title": "显示工具输入", "language": "python", "code": "print(42)",
      "run_instructions": "复制这段代码替换右侧编辑器内容，然后点击运行，在下方终端看结果。",
      "expected_output": "42", "explanation": "print是把括号里的内容显示出来的函数。这里括号中的42是一个整数，执行后终端会显示42。这条语句让你观察程序的结果。"}
    return {"body": "先把一个值交给程序，再观察它输出的内容。" * 25,
      "analogy": "可以把显示输出想成在纸上写下计算结果，让别人看得见。但print不是保存文件，关闭运行环境后不会保留这张纸。",
      "terms": [{"term": "print", "meaning": "把括号中的内容显示到下方输出区域的函数。"}],
      "steps": ["先复制下方第一个例子的全部代码。", "点击右侧编程台，选中全部内容并粘贴。", "点击运行，在下方终端找到输出结果。"],
      "examples": [example, {**example, "title": "改变显示内容", "code": "print(43)", "expected_output": "43"}],
      "exercise": "把42改为43后运行", "starter_code": "print(42)",
      "mistakes": ["如果没有看到输出，检查是否遗漏了print这一行。", "如果出现括号错误，检查左右括号是否成对出现。"],
      "hints": ["先找到例子中括号内部的数字42。", "只把这个数字改成43，保留其他字符。"],
      "checks": [{"question": "运行print(42)会看到什么？", "answer": "会显示42，因为print会展示括号里的整数。"},
                 {"question": "改变括号中的数字会发生什么？", "answer": "输出会随数字改变，因为print使用的输入改变了。"}]}


def test_tutorial_rejects_missing_explanation_without_retry(upstream):
    requests, responses = upstream
    tutorial = beginner_fixture()
    tutorial['examples'][0]['explanation'] = ''
    responses.append(completion(json.dumps(tutorial)))
    result = TestClient(app).post('/api/ai/lesson', json={"connection": CONFIG, "goal": "编程", "title": "函数", "description": "入门", "background": "零基础"})
    assert result.status_code == 502 and len(requests) == 1


def test_tutorial_rejects_broken_or_placeholder_examples():
    from taiji_api.ai import BeginnerTutorial
    for code in ['def broken(', 'pass', 'name = input()', '...']:
        data = beginner_fixture()
        data['examples'][0]['code'] = code
        with pytest.raises((ValidationError, SyntaxError)):
            BeginnerTutorial.model_validate(data)
