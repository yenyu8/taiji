'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { fromRoadmap, normalizePlan, toRoadmap, type Quality, type LearningSupport, type Plan, type Lesson, type Roadmap, type Provenance } from '../lib/learning-plan';
import { runPython } from '../lib/python-runner';
import TutorialText, { CopyCode } from './components/TutorialText';
const CodeEditor = dynamic(() => import('./components/CodeEditor'), { ssr: false });

type Message = { role: 'assistant' | 'user'; text: string };
const greeting: Message = { role: 'assistant', text: '可以直接提问，也可以在编程台选中代码后点击「询问选中代码」。发送时会把当前教程、代码和选中片段交给你配置的模型。' };
async function aiRequest<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/ai/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(195000)]) : AbortSignal.timeout(path === 'test' ? 45000 : 390000) }); } catch (error) { if (signal?.aborted) throw new Error('已停止等待，不会自动重试。已发送的请求可能仍由服务商计费。'); throw new Error(error instanceof Error && error.name === 'TimeoutError' ? '等待模型超时，请重试或换一个模型。已有内容已保留。' : '暂时连接不上，请确认太极后端已启动并检查网络。'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('后端没有返回有效响应，请确认后端服务已启动。'); }
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '请求未完成，请检查模型配置。');
  return data as T;
}
const STORE = 'taiji.frontend.plan.v1';
const phases = ['编程基础', '模型与工具', '构建 Agent'];
const providers: Record<string, { url: string; model: string }> = {
  'OpenAI': { url: 'https://api.openai.com/v1', model: '自定义模型名称' },
  'DeepSeek': { url: 'https://api.deepseek.com', model: '自定义模型名称' },
  '本地 / Ollama': { url: 'http://localhost:11434/v1', model: '本地模型名称' },
  '自定义兼容接口': { url: '', model: '' },
};
function samplePlan(goal: string, level: string, hours: string): Plan {
  const content = [
    ['函数与结构化数据', '编程基础', '让你的第一个工具函数返回可被程序读取的数据。', '函数把输入转换成输出。Agent 调用工具时，需要知道函数接收哪些参数，以及会返回什么。先用字典组织结果，让每个字段都有清楚的含义。', '实现 weather_tool(city)，返回包含 city 和 forecast 的字典。', 'def weather_tool(city):\n    # 在这里组织并返回天气信息\n    pass\n'],
    ['处理输入与异常', '编程基础', '让工具面对不完整的输入时也有明确的行为。', '外部输入并不总是符合预期。先检查城市名称是否为空，再处理正常路径。错误信息需要帮助调用方决定下一步，而不是让整个程序悄悄失败。', '为天气工具添加空字符串检查，并返回清晰的错误结果。', 'def weather_tool(city):\n    # 检查输入，再返回结果\n    pass\n'],
    ['理解模型对话', '模型与工具', '用消息列表描述一次有上下文的对话。', '一次模型对话由不同角色的消息组成。系统消息描述行为要求，用户消息提出任务，助手消息保存回答。保留必要的历史能帮助模型理解上下文。', '构建一份包含系统要求和用户问题的 messages 列表。', 'messages = [\n    # 添加角色与消息内容\n]\n'],
    ['定义工具协议', '模型与工具', '让模型理解一个工具可以做什么。', '工具描述应说明名称、用途和参数。模型产生的调用请求仍需要程序校验；不能因为请求来自模型，就跳过参数和权限检查。', '用字典声明天气工具的名称、描述和参数。', 'tool = {\n    "name": "weather_tool",\n    # 补充描述和参数\n}\n'],
    ['搭建 Agent 循环', '构建 Agent', '连接推理、工具调用和结果反馈。', '最小 Agent 循环包括接收任务、请求模型、校验工具调用、执行工具、回传结果。为循环设置最大步数，避免无休止地重复调用。', '写出一个最多执行三步的 Agent 循环骨架。', 'def agent_loop(messages, max_steps=3):\n    # 请求模型 → 校验调用 → 回传结果\n    pass\n'],
    ['完成与评估', '构建 Agent', '通过完整任务检查你的实现。', '评估需要可复现的输入和明确的预期结果。分别检查正常情况、错误输入和工具失败情况，再记录哪些行为符合要求，哪些仍需改进。', '为你的 Agent 列出三个独立测试场景。', 'test_cases = [\n    # 正常、异常、失败恢复\n]\n'],
  ];
  return { version: 1, title: 'Agent 开发学习路线', goal, level, hours, lessons: content.map((x, i) => ({ id: `lesson-${i + 1}`, title: x[0], phase: x[1], intro: x[2], body: x[3], exercise: x[4], code: x[5], done: false })) };
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState('OpenAI');
  const [baseUrl, setBaseUrl] = useState(providers.OpenAI.url);
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [goal, setGoal] = useState('独立开发一个能够调用工具的 AI Agent');
  const [level, setLevel] = useState('有一点编程基础');
  const [hours, setHours] = useState('每周 5 小时');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [active, setActive] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [message, setMessage] = useState('');
  const [terminal, setTerminal] = useState('Python 标准库环境已准备。点击运行执行代码；每次运行使用独立环境。');
  const [outputTab, setOutputTab] = useState('终端');
  const [notice, setNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preferences, setPreferences] = useState('');
  const [revision, setRevision] = useState('');
  const [candidate, setCandidate] = useState<Plan | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [auditRoute, setAuditRoute] = useState(true);
  const [repairRoute, setRepairRoute] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('准备请求');
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const generationRequest = useRef<{ id: string; controller: AbortController } | null>(null);
  const [mod, setMod] = useState('programming');
  const fileRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [apiTestBusy, setApiTestBusy] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelStatus, setModelStatus] = useState('粘贴 API Key 后，自动为你读取可选模型。');
  const [modelRefresh, setModelRefresh] = useState(0);
  const [connectionError, setConnectionError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [usage, setUsage] = useState<{estimated_tokens:number; daily_budget:number; remaining_tokens:number; requests:number} | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [lessonBusy, setLessonBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [questionCode, setQuestionCode] = useState('');
  const [assessment, setAssessment] = useState('尚未提交评估。');
  const [debugOutput, setDebugOutput] = useState('运行后在这里查看 Python 异常堆栈。当前不支持交互式断点调试。');
  const runner = useRef<AbortController | null>(null);
  const contextId = useRef('');
  const planEpoch = useRef(0);
  const connectionRevision = useRef(0);
  const lastRun = useRef<{ lessonId: string; code: string; output: string } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { try { const saved = localStorage.getItem(STORE); if (saved) { const p = normalizePlan(JSON.parse(saved)); setPlan(p); setGoal(p.goal); setLevel(p.level); setHours(p.hours); setPreferences(p.learningPreferences || ''); } const config = localStorage.getItem('taiji.model.preferences'); if (config) { const c = JSON.parse(config); if (typeof c.baseUrl === 'string') setBaseUrl(c.baseUrl); if (typeof c.model === 'string') setModel(c.model); if (Object.hasOwn(providers, c.provider)) setProvider(c.provider); } } catch { setNotice('浏览器记录无法读取，可重新创建或导入。'); } return () => runner.current?.abort(); }, []);
  useEffect(() => {
    const cancelOnLeave = () => {
      const active = generationRequest.current;
      if (active) { navigator.sendBeacon(`/api/ai/roadmap/cancel/${active.id}`); active.controller.abort(); }
    };
    window.addEventListener('pagehide', cancelOnLeave);
    return () => { window.removeEventListener('pagehide', cancelOnLeave); cancelOnLeave(); };
  }, []);
  useEffect(() => { connectionRevision.current++; setConnected(false); setConnectionError(''); }, [baseUrl, model, key]);
  useEffect(() => {
    setModelOptions([]);
    const local = provider === '本地 / Ollama';
    if (!baseUrl.trim() || (!key.trim() && !local)) {
      setModelsBusy(false);
      setModelStatus(!baseUrl.trim() ? '其他平台需要先填写它提供的接口地址。' : '粘贴 API Key 后，自动为你读取可选模型。');
      return;
    }
    const controller = new AbortController();
    let current = true;
    setModelsBusy(true);
    setModelStatus('正在读取模型，请稍候…');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/ai/models', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base_url: baseUrl, api_key: key.trim() }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '暂时无法读取模型，请稍后重试。');
        if (!current) return;
        const names = Array.from(new Set<string>((data.models as string[]).filter(name => !/(embed|rerank|whisper|tts|dall-e|moderation|transcri|audio|realtime|image|sora)/i.test(name))));
        setModelOptions(names);
        setModel(previous => names.includes(previous) ? previous : names[0] || '');
        setModelStatus(names.length ? `已找到 ${names.length} 个模型，已为你选好一个，也可以下拉更换。` : '这个平台未提供可选的对话模型。可重试，或在高级设置中填写平台提供的模型名称。');
      } catch (error) {
        if (!current) return;
        setModelStatus(error instanceof Error && error.name === 'TimeoutError' ? '读取超时，请检查网络后点击「重新读取」。' : error instanceof TypeError ? '暂时无法连接，请检查网络与太极后端，再点击「重新读取」。' : error instanceof Error ? error.message : '读取失败，请检查密钥后重试。');
      } finally { if (current) setModelsBusy(false); }
    }, 1000);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [provider, baseUrl, key, modelRefresh]);
  useEffect(() => {
    let active = true;
    const read = () => fetch('/api/ai/usage').then(r => r.ok ? r.json() : null).then(v => { if (active && v) setUsage(v); }).catch(() => {});
    void read(); const timer = setInterval(() => void read(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => { if (!plan) return; const id = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(normalizePlan(plan))); } catch { setNotice('自动保存失败，请导出学习文件。'); } }, 800); return () => clearTimeout(id); }, [plan]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, assistantOpen]);
  const lesson = plan?.lessons[active];
  contextId.current = `${planEpoch.current}:${lesson?.id || ''}`;
  useEffect(() => { setSelectedCode(''); setQuestionCode(''); setMessages([greeting]); setMessage(''); setAssessment('尚未提交本节代码评估。'); setDebugOutput('运行后显示本节异常信息。'); runner.current?.abort(); lastRun.current = null; }, [lesson?.id, planEpoch.current]);
  const connection = { base_url: baseUrl, model, api_key: key };
  function requireModel() { if (!baseUrl.trim() || !model.trim()) { setNotice('请先在「接入模型」粘贴 API Key，并从下拉框选择模型。'); return false; } return true; }
  async function testApiKey() {
    if (!key.trim() && provider !== '本地 / Ollama') { setConnectionError('请先粘贴 API Key。'); return; }
    if (!baseUrl.trim()) { setConnectionError('请先选择平台，或在高级设置填写接口地址。'); return; }
    setApiTestBusy(true); setConnectionError('');
    try {
      const data = await aiRequest<{ models: string[] }>('models', { base_url: baseUrl, api_key: key.trim() });
      const names = Array.from(new Set((data.models || []).filter(name => !/(embed|rerank|whisper|tts|dall-e|moderation|transcri|audio|realtime|image|sora)/i.test(name))));
      setModelOptions(names);
      setModel(previous => names.includes(previous) ? previous : names[0] || previous);
      setModelStatus(names.length ? `API 可用，已找到 ${names.length} 个模型。` : 'API 可用，但平台没有返回模型列表；请在高级设置填写模型名称。');
      setConnected(false);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'API 暂时无法连接，请检查密钥和平台。');
    } finally { setApiTestBusy(false); }
  }

  async function testConnection(continueAfter = false) {
    if (!key.trim() && provider !== '本地 / Ollama') { setConnectionError('先粘贴你的 API Key，再点击连接。'); return; }
    if (!baseUrl.trim() || !model.trim()) { setConnectionError('请先选择一个模型。列表为空时点击「重新读取」，或展开高级设置。'); return; }
    const revision = connectionRevision.current;
    setConnectionBusy(true); setConnectionError('');
    try {
      await aiRequest('test', connection);
      if (revision !== connectionRevision.current) return;
      setConnected(true);
      try { localStorage.setItem('taiji.model.preferences', JSON.stringify({ baseUrl, model, provider })); } catch { /* Optional preferences only. */ }
      setNotice('连接成功，可以开始设置学习目标。');
      if (continueAfter) setStep(1);
    } catch (error) {
      if (revision !== connectionRevision.current) return;
      setConnected(false);
      setConnectionError(error instanceof Error ? error.message : '暂时连接不上，请检查密钥和网络后重试。');
    } finally { setConnectionBusy(false); }
  }
  const completed = plan?.lessons.filter(l => l.done).length || 0;
  const groups = plan ? Array.from(new Set(plan.lessons.map(l => l.phase))) : phases;
  function updateLesson(fields: Partial<Lesson>) { setPlan(p => p ? { ...p, lessons: p.lessons.map((l, i) => i === active ? { ...l, ...fields } : l) } : p); }
  function save() { if (!plan) return; try { localStorage.setItem(STORE, JSON.stringify(normalizePlan(plan))); setNotice('学习路线、教程和代码已保存到此浏览器。'); } catch { setNotice('本地保存失败，请导出文件保存。'); } }
  function download() { if (!plan) return; const url = URL.createObjectURL(new Blob([JSON.stringify(normalizePlan(plan), null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'taiji-learning-plan.json'; a.click(); URL.revokeObjectURL(url); setNotice('已导出路线、教程和代码，不包含 API Key。'); }
  async function importPlan(file?: File) { if (!file) return; try { if (file.size > 2_000_000) throw new Error('文件不能超过 2 MB'); const p = normalizePlan(JSON.parse(await file.text())); planEpoch.current++; setPlan(p); setActive(0); setGoal(p.goal); setLevel(p.level); setHours(p.hours); setStep(2); setNotice('导入成功，可以继续学习。'); } catch (e) { setNotice(`导入失败：${e instanceof Error ? e.message : '无法读取文件'}`); } }
  async function stopGeneration() {
    const current = generationRequest.current;
    if (!current) return;
    setGenerationStatus('正在停止…');
    try {
      const response = await fetch(`/api/ai/roadmap/cancel/${current.id}`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      setGenerationError(response.ok ? '已通知后端停止，不会继续修正或复核。已发送的请求可能仍计费。' : '停止通知未确认，已中止页面等待；后端仍受3分钟上限约束。');
    } catch { setGenerationError('停止通知未确认，已中止页面等待；后端仍受3分钟上限约束。'); }
    finally { current.controller.abort(); }
  }
  async function generate() {
    if (generationRequest.current) return;
    if (!goal.trim()) { setGenerationError('写下你想完成的一件事，例如：做一个能调用天气工具的 Agent。'); return; }
    if (!connected) { setStep(0); setNotice('请先点击「连接并继续」，确认这个模型可以使用。'); return; }
    if (!requireModel()) return;
    setGenerating(true); setGenerationError(''); setCandidate(null);
    const epoch = planEpoch.current;
    const current = { id: crypto.randomUUID(), controller: new AbortController() };
    generationRequest.current = current;
    setGenerationSeconds(0); setGenerationStatus('正在发送请求');
    const started = Date.now();
    let checking = false;
    const timer = setInterval(async () => {
      setGenerationSeconds(Math.floor((Date.now() - started) / 1000));
      if (checking) return;
      checking = true;
      try {
        const response = await fetch(`/api/ai/roadmap/status/${current.id}`, { signal: AbortSignal.timeout(2000) });
        if (response.ok && generationRequest.current === current) {
          const status = await response.json();
          setGenerationStatus(`${status.stage} · 已请求 ${status.calls}/${status.limit} 次`);
        }
      } catch { /* Local status checks never call the model. */ }
      finally { checking = false; }
    }, 1000);
    try {
      const data = await aiRequest<{ roadmap: Roadmap; provenance: Provenance; quality: Quality }>('roadmap', { connection, goal, background: level, preferences, revision, current_roadmap: plan && revision.trim() ? toRoadmap(plan) : undefined, weekly_hours: Number(hours.match(/\d+/)?.[0]) || 5, audit: auditRoute, repair: repairRoute, request_id: current.id }, current.controller.signal);
      if (epoch !== planEpoch.current) { setNotice('当前路线已切换，这次生成结果未覆盖你正在使用的内容。'); return; }
      const next = fromRoadmap(data.roadmap, goal, level, hours, data.provenance, data.quality);
      next.learningPreferences = preferences;
      if (plan) { setCandidate(next); setNotice('新路线已生成，请预览后决定是否采用。原路线和代码仍保留。'); }
      else { planEpoch.current++; setPlan(next); setActive(0); setStep(2); setNotice(data.provenance.ai_reviewed ? '路线已生成并经AI复核，请查看实践任务与完成标准。' : '初稿已生成，AI复核未完成，请查看路线提示。'); }
    } catch (e) { if (!current.controller.signal.aborted) setGenerationError(e instanceof Error ? e.message : '生成失败，请稍后重试。'); } finally { clearInterval(timer); generationRequest.current = null; setGenerating(false); }
  }
  function adoptCandidate() {
    if (!candidate) return;
    if (plan) {
      try { localStorage.setItem('taiji.frontend.plan.backup', JSON.stringify(normalizePlan(plan))); }
      catch { setGenerationError('旧路线备份失败，请先导出原路线再重试。'); return; }
    }
    planEpoch.current++; setPlan(candidate); setCandidate(null); setRevision(''); setActive(0); setStep(2);
    setNotice('新路线已采用，原路线已备份，可在学习路线页恢复。');
  }
  function restoreBackup() {
    try {
      const value = localStorage.getItem('taiji.frontend.plan.backup');
      if (!value) { setNotice('暂无备份。采用新路线时会自动保存上一版。'); return; }
      const old = normalizePlan(JSON.parse(value));
      if (!window.confirm('恢复上一版路线？当前版本会成为新的备份。')) return;
      if (plan) localStorage.setItem('taiji.frontend.plan.backup', JSON.stringify(normalizePlan(plan)));
      planEpoch.current++; setPlan(old); setGoal(old.goal); setLevel(old.level); setHours(old.hours); setActive(0); setCandidate(null);
    } catch { setNotice('备份恢复失败，当前路线已保留。'); }
  }
  function loadExample() { if (plan && !window.confirm('载入示例将替换当前路线，是否继续？')) return; const p = samplePlan(goal, level, hours); p.lessons[0].examples = [{ language: 'python', title: '一个可运行的工具函数', code: 'def weather_tool(city):\n    return {"city": city, "forecast": "sunny"}\n\nprint(weather_tool("北京"))' }]; planEpoch.current++; setPlan(p); setActive(0); setStep(2); setNotice('已加载官方示例，Python 编程台可直接运行。'); }
  async function generateLesson() {
    if (!lesson || !plan || lessonBusy || !requireModel()) return;
    const snapshot = lesson; const epoch = planEpoch.current;
    setLessonBusy(true);
    try {
      const data = await aiRequest<{ body: string; exercise: string; starter_code: string; learning_support: LearningSupport; quality_note: string; examples: NonNullable<Lesson['examples']> }>('lesson', { connection, goal: plan.goal, title: lesson.title, description: lesson.intro, background: `${plan.level}。${plan.learningPreferences || preferences}`, practice: lesson.exercise, acceptance: lesson.acceptance || '', previous_topics: plan.lessons.slice(0, active).map(l => l.title) });
      if (epoch !== planEpoch.current) return;
      setPlan(p => p ? { ...p, lessons: p.lessons.map(l => l.id === snapshot.id ? { ...l, body: data.body, exercise: data.exercise, examples: data.examples, learning_support: data.learning_support, quality_note: data.quality_note, code: l.code.trim() ? l.code : data.starter_code, contentReady: true } : l) } : p);
      setNotice(`「${snapshot.title}」教程已生成，示例代码可复制。`);
    } catch (e) { setNotice(String(e)); } finally { setLessonBusy(false); }
  }
  async function copyCode(code: string) { try { await navigator.clipboard.writeText(code); setNotice('代码已复制，可以粘贴到右侧编程台。'); } catch { setNotice('浏览器未允许复制，请选中代码后按 Ctrl+C。'); } }
  function askSelection(text: string) { setQuestionCode(text); setMessage('这段代码 / 这个函数是做什么的？请逐步解释。'); setAssistantOpen(true); }
  async function sendChat(evaluate = false) {
    if (!lesson || aiBusy || !requireModel() || (!evaluate && !message.trim())) return;
    const ctx = contextId.current;
    const question = evaluate ? `请评估「${lesson.title}」的当前实现，给出有依据的分项评分与建议。` : message.trim();
    const history = [...messages.slice(1), { role: 'user' as const, text: question }].slice(-20);
    const selection = evaluate ? '' : questionCode;
    setMessages(p => [...p, { role: 'user', text: question + (selection ? `\n\n引用代码：\n${selection}` : '') }]);
    setMessage(''); setQuestionCode(''); setAiBusy(true); setAssistantOpen(true);
    try {
      const run = lastRun.current;
      const data = await aiRequest<{ text: string }>('chat', { connection, messages: history.map(m => ({ role: m.role, content: m.text })),
        lesson_title: lesson.title, lesson_body: lesson.body, code: lesson.code, selected_code: selection,
        runtime_output: run?.lessonId === lesson.id && run.code === lesson.code ? run.output.slice(0, 12000) : '当前版本未运行。', evaluate });
      if (ctx !== contextId.current) return;
      setMessages(p => [...p, { role: 'assistant', text: data.text }]);
      if (evaluate) { setAssessment(data.text); setOutputTab('评估'); }
    } catch (e) { if (ctx === contextId.current) { setMessages(p => [...p, { role: 'assistant', text: `请求失败：${String(e)}。请检查模型设置后重试。` }]); setMessage(question); setQuestionCode(selection); } }
    finally { setAiBusy(false); }
  }
  function chat() { void sendChat(); }
  function evaluate() { void sendChat(true); }
  async function executeCode() {
    if (!lesson || running) return;
    const snapshot = lesson; const ctx = contextId.current;
    const controller = new AbortController(); runner.current = controller; setRunning(true); setOutputTab('终端');
    try {
      const output = await runPython(snapshot.code, status => { if (ctx === contextId.current) setTerminal(status); }, controller.signal);
      if (ctx !== contextId.current) return;
      const text = [output.stdout, output.stderr, output.error, `\n${output.error ? '运行失败' : '运行结束'} · ${output.durationMs} ms${!output.stdout && !output.error ? ' · 无输出，请使用 print() 显示结果' : ''}`].filter(Boolean).join('\n');
      setTerminal(text); setDebugOutput(output.error || output.stderr || '本次运行没有捕获异常。'); lastRun.current = { lessonId: snapshot.id, code: snapshot.code, output: text };
    } catch (e) { if (ctx === contextId.current) { const text = String(e); setTerminal(text); setDebugOutput(text); } }
    finally { setRunning(false); }
  }
  return <div className="app">
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setStep(0); }}><svg className="taiji-logo" viewBox="0 0 40 40" aria-label="太极图案" role="img"><circle cx="20" cy="20" r="18" fill="white" stroke="#243552" strokeWidth="1.5"/><path d="M20 2a18 18 0 0 1 0 36 9 9 0 0 1 0-18 9 9 0 0 0 0-18Z" fill="#243552"/><circle cx="20" cy="11" r="3" fill="#243552"/><circle cx="20" cy="29" r="3" fill="white"/></svg><strong>太极</strong></a><nav aria-label="学习阶段">{['接入模型', '学习信息', '学习路线', '学习工作台'].map((name, i) => <button key={name} className={step === i ? 'nav-item selected' : 'nav-item'} disabled={i > 1 && !plan} onClick={() => setStep(i)}><span className="step-number">{i + 1}</span>{name}</button>)}</nav><div className="header-actions"><span className="demo-tag">{connected ? "模型已连接" : "本地学习空间"}</span><button className="avatar" onClick={() => setStep(0)} title="模型设置">⚙</button></div></header>
    <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { void importPlan(e.target.files?.[0]); e.target.value = ''; }} />
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {step === 0 && <main className="onboarding">
      <div className="intro"><span className="overline">YOUR LEARNING, YOUR MODEL</span><h1>给太极连接一个 AI</h1><p>选平台、粘贴 API Key，剩下的交给太极。</p></div>
      <div className="setup-card">
        <div className="card-title"><span className="icon-tile">✧</span><div><h2>三步，开始学习</h2><p>不需要了解接口地址或记住模型名称</p></div><span className="muted-tag">{connected ? '已连接' : '首次设置'}</span></div>
        <label>① 你的 API Key 来自哪个平台？
          <select value={provider} disabled={connectionBusy} onChange={e => { const next = e.target.value; setProvider(next); setBaseUrl(providers[next].url); setKey(''); setModel(''); setModelOptions([]); setShowKey(false); }}>
            {Object.keys(providers).map(name => <option key={name} value={name}>{name === '自定义兼容接口' ? '其他平台 / 中转服务' : name}</option>)}
          </select>
        </label>
        <p className="setup-help">选择你获取密钥的平台。不同平台的密钥不能混用，也无法仅凭密钥准确识别平台。</p>
        <label htmlFor="model-api-key">② 粘贴 API Key{provider === '本地 / Ollama' && <small>本地服务通常不用填</small>}</label>
        <div className="key-entry"><input id="model-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} disabled={connectionBusy || apiTestBusy} value={key} onChange={e => setKey(e.target.value.trim())} placeholder="把你复制的 API Key 粘贴到这里" /><button type="button" className="key-test" disabled={connectionBusy || apiTestBusy} onClick={() => void testApiKey()}>{apiTestBusy ? '测试中…' : '测试 API'}</button><button type="button" aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} onClick={() => setShowKey(!showKey)}>{showKey ? '隐藏' : '显示'}</button></div>
        <p className="setup-help">API Key 是平台提供的一串密钥，不是网址，也不是登录密码。刷新页面后需要重新填写。</p>
        <label>③ 选择学习时使用的模型
          <select value={model} disabled={modelsBusy || connectionBusy || !modelOptions.length} onChange={e => setModel(e.target.value)}>
            {!model && <option value="">{modelsBusy ? '正在读取模型…' : '填写密钥后，这里会出现模型列表'}</option>}
            {model && !modelOptions.includes(model) && <option value={model}>{model}（手动设置 / 上次选择）</option>}
            {modelOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="model-feedback"><p role="status">{modelStatus}</p><button className="text-button" disabled={modelsBusy || connectionBusy || !baseUrl.trim() || (!key.trim() && provider !== '本地 / Ollama')} onClick={() => setModelRefresh(value => value + 1)}>重新读取</button></div>
        <details className="model-advanced" key={provider} open={provider === '自定义兼容接口' ? true : undefined}>
          <summary>高级设置 <span>一般不用改</span></summary>
          <p className="setup-help">其他平台请使用提供密钥时附带的接口地址；模型列表不受支持时，可手动填写模型名称。修改地址后需重新粘贴密钥。</p>
          <label>接口地址<input value={baseUrl} disabled={connectionBusy} onChange={e => { setBaseUrl(e.target.value); setKey(''); setModel(''); }} placeholder="https://your-provider.example/v1" /></label>
          <label>手动填写模型名称<input value={model} disabled={connectionBusy || modelsBusy} onChange={e => setModel(e.target.value)} placeholder="仅在模型列表不可用时填写" /></label>
        </details>
        {connectionError && <div className="connection-error" role="alert">{connectionError}</div>}
        <p className="inline-note">密钥仅用于连接你选择的平台，不写入学习文件。连接测试和后续学习会使用模型服务，费用由该平台收取。</p>{usage && <p className="usage-note">本地用量保护：今日已估算 {usage.estimated_tokens.toLocaleString()} / {usage.daily_budget.toLocaleString()} Token，剩余 {usage.remaining_tokens.toLocaleString()}；已发起 {usage.requests} 次请求。达到上限会直接停止，不自动重试。</p>}
        <div className="card-actions"><button className="text-button" onClick={() => fileRef.current?.click()}>↥ 导入已有学习文件</button><button className="primary" disabled={connectionBusy || modelsBusy} onClick={() => connected ? setStep(1) : void testConnection(true)}>{connectionBusy ? '正在检查连接…' : connected ? '开始设置学习目标 →' : '连接并继续 →'}</button></div>
        <button className="sample-link" onClick={() => setStep(1)}>暂时没有 API Key？先体验官方示例 →</button>
      </div>
      {plan && <button className="resume" onClick={() => setStep(3)}>继续已有学习：{plan.title} →</button>}
      <div className="onboarding-foot"><span>01 连接 AI</span><i /><span>02 定义目标</span><i /><span>03 开始学习</span></div>
    </main>}
    {step === 1 && <main className="onboarding"><div className="intro"><span className="overline">A PATH THAT STARTS WITH YOU</span><h1>这一次，你想学会什么？</h1><p>告诉学习助手你的目标和起点，让路线有方向，也有节奏。</p></div><div className="setup-card"><div className="card-title"><span className="icon-tile">↗</span><div><h2>你的学习档案</h2><p>{provider} · {model || '尚未选择模型'}</p></div></div><label>我想达到的目标<textarea rows={3} value={goal} onChange={e => setGoal(e.target.value)} placeholder="例如：独立开发一个 AI Agent" /></label><div className="form-two"><label>目前的基础<select value={level} onChange={e => setLevel(e.target.value)}><option>完全零基础</option><option>有一点编程基础</option><option>能独立完成编程项目</option></select></label><label>每周投入时间<select value={hours} onChange={e => setHours(e.target.value)}><option>每周 3 小时</option><option>每周 5 小时</option><option>每周 10 小时</option></select></label></div><label>还有什么希望 AI 知道？<small>可选</small><textarea rows={2} value={preferences} maxLength={2000} onChange={e => setPreferences(e.target.value)} placeholder="例如：函数还不熟，希望多举例，每次学习不要太长" /></label>{plan && <label>希望怎样调整已有路线？<small>可选</small><textarea rows={2} value={revision} maxLength={2000} onChange={e => setRevision(e.target.value)} placeholder="例如：补充基础，减少理论，多安排动手练习" /></label>}<div className="preview-info"><span>✧</span><p>先规划，再复核前置知识、难度和练习。每节都会说明学会什么、动手做什么、怎样检查完成。复杂目标会先收敛成一项可完成的成果。</p></div><div className="route-request-options"><label><input type="checkbox" checked={auditRoute} disabled={generating} onChange={e => setAuditRoute(e.target.checked)} />生成后让 AI 复核（额外一次请求）</label><label><input type="checkbox" checked={repairRoute} disabled={generating} onChange={e => setRepairRoute(e.target.checked)} />允许格式失败时修正一次（可能额外收费）</label><p className="inline-note">本次最多 {1 + Number(auditRoute) + Number(repairRoute)} 次上游请求，最长等待 3 分钟；失败后不自动重新生成。输出上限：生成/修正各 6,000 Token，复核 8,000 Token；不包含输入费用。</p></div>{generating && <div className="connection-error" role="status"><strong>{generationStatus}</strong><p>已等待 {generationSeconds} 秒 / 最长 180 秒。{generationSeconds > 45 ? '模型响应较慢，可以停止或继续等待。' : '请勿重复提交。'}</p><button className="secondary" onClick={stopGeneration}>停止生成</button></div>}{generationError && <div className="connection-error" role="alert">{generationError}</div>}{candidate && <section className="candidate-preview"><h3>新路线预览 · 原路线仍保留</h3><p>{candidate.title}</p><p>{candidate.lessons.length} 节 · 约 {candidate.quality?.total_hours} 小时 · 按你的安排约 {candidate.quality?.estimated_weeks} 周</p>{candidate.quality?.concerns.map((item, i) => <p key={i}>{item}</p>)}<ol>{candidate.lessons.map(item => <li key={item.id}><strong>{item.title}</strong><p>{item.outcome || item.intro}</p><small>练习：{item.exercise}<br />完成标准：{item.acceptance}</small></li>)}</ol><div className="button-row"><button className="primary" onClick={adoptCandidate}>采用新路线并备份原版</button><button className="secondary" onClick={() => setCandidate(null)}>保留原路线</button></div></section>}<div className="card-actions"><button className="text-button" onClick={() => setStep(0)}>← 返回模型设置</button><button disabled={generating} className="primary" onClick={generate}>{generating ? '模型正在生成并复核路线…' : plan ? '重新生成学习路线 →' : '生成学习路线 →'}</button></div><button className="sample-link" disabled={generating} onClick={loadExample}>暂不连接模型，先载入官方示例</button>{plan && <p className="inline-note">新路线会先供你预览；采用后自动备份原版，学习进度从新路线重新开始。</p>}</div></main>}
    {step === 2 && plan && <main className="roadmap"><div className="page-heading"><div><div className="breadcrumb">学习空间 / 我的路线</div><h1>{plan.title}</h1><p>{plan.goal}</p></div><div className="button-row"><button className="secondary" onClick={() => fileRef.current?.click()}>导入</button><button className="secondary" onClick={() => setStep(1)}>调整路线</button><button className="secondary" onClick={restoreBackup}>恢复上一版</button><button className="secondary" onClick={download}>↧ 导出路线</button><button className="primary" onClick={() => setStep(3)}>进入学习工作台 →</button></div></div><div className="route-meta"><span>◷ {plan.hours}</span><span>◈ {plan.level}</span><span>{groups.length} 个阶段 · {plan.lessons.length} 个任务</span><span className="route-progress">手动完成 {completed} / {plan.lessons.length}</span></div>{plan.quality && <section className="route-quality"><strong>约 {plan.quality.total_hours} 小时 · 按你的安排约 {plan.quality.estimated_weeks} 周</strong><p>{plan.provenance?.ai_reviewed ? 'AI复核已完成' : 'AI复核未完成'} · 时间是估算，可按实际进度调整</p>{plan.quality.changes.length > 0 && <details><summary>查看本次路线改进</summary><ul>{plan.quality.changes.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}{plan.quality.concerns.map((item, i) => <p key={i}>{item}</p>)}</section>}<div className="route-layout"><div className="phase-list">{groups.map((phase, i) => <section key={phase} className="phase"><div className="phase-head"><span className="phase-index">{String(i + 1).padStart(2, '0')}</span><div><span className="overline">STAGE {i + 1}</span><h2>{phase}</h2></div><span className="phase-count">{plan.lessons.filter(l => l.phase === phase).length} 个学习任务</span></div>{plan.lessons.map((l, index) => l.phase === phase && <button className="lesson-row" key={l.id} onClick={() => { setActive(index); setStep(3); }}><span className={l.done ? 'lesson-check checked' : 'lesson-check'}>{l.done ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{l.title}</strong><p>{l.outcome || l.intro}</p>{l.est_hours && <small>约 {l.est_hours} 小时 · 难度 {l.difficulty}/5</small>}{l.exercise && <p>练习：{l.exercise}</p>}{l.acceptance && <p>完成标准：{l.acceptance}</p>}</div><span>↗</span></button>)}</section>)}</div><aside className="route-side"><span className="icon-tile">◈</span><h3>把知识变成实践</h3><p>每个阶段都可以直接进入工作台。教程和代码随学习文件保存，随时导出，在下一次继续。</p><hr /><small>当前学习包</small><strong>Agent Developer</strong><span className="muted-tag">{plan.provenance ? "AI 生成 · 编程 Mod" : "导入 / 官方示例"}</span><button className="secondary" onClick={save}>保存到本机</button><p className="fine-print">{plan.provenance ? `${plan.provenance.model} · ${plan.provenance.ai_reviewed ? "经 AI 复核" : "未经 AI 复核"}。路线仍需结合实际学习调整。` : "此路线来自导入文件或官方示例。"}</p></aside></div></main>}
    {step === 3 && plan && lesson && <main className="workbench"><div className="work-toolbar"><div className="toolbar-left"><button className="square-button" aria-label={collapsed ? '展开学习目录' : '收起学习目录'} onClick={() => setCollapsed(!collapsed)}>☰</button><div className="breadcrumb">学习工作台 <span>/</span> <strong>{lesson.title}</strong></div></div><div className="button-row"><label className="mod-select">MOD<select aria-label="选择 Mod" value={mod} onChange={e => setMod(e.target.value)}><option value="programming">编程学习包</option><option value="reading">仅阅读教程</option></select></label><button className="secondary" onClick={save}>保存</button><button className="secondary" onClick={download}>导出</button><button className={assistantOpen ? 'assistant-trigger active' : 'assistant-trigger'} onClick={() => setAssistantOpen(!assistantOpen)}>✧ AI 助手</button></div></div><div className={`work-layout ${collapsed ? 'directory-collapsed' : ''} ${mod === 'reading' ? 'reading-mode' : ''}`}>
      {!collapsed && <aside className="directory"><div className="directory-title"><strong>学习目录</strong><small>{completed}/{plan.lessons.length}</small></div><div className="thin-progress"><i style={{ width: `${completed / plan.lessons.length * 100}%` }} /></div>{groups.map((phase, i) => <div className="directory-group" key={phase}><h3><span>{String(i + 1).padStart(2, '0')}</span>{phase}</h3>{plan.lessons.map((l, index) => l.phase === phase && <button key={l.id} className={active === index ? 'directory-lesson current' : 'directory-lesson'} onClick={() => { setActive(index); setTerminal('已切换任务。当前代码已保留在本次学习会话。'); }}><span>{l.done ? '✓' : '○'}</span>{l.title}</button>)}</div>)}<button className="back-route" onClick={() => setStep(2)}>← 查看完整路线</button></aside>}
      <section className="tutorial"><div className="pane-heading"><span>教程</span><span className="muted-tag">{lesson.contentReady === false ? "待生成教程" : "教程已保存"}</span></div><article><div className="overline">{lesson.phase} / LESSON {active + 1}</div><h1>{lesson.title}</h1><p className="lesson-lead">{lesson.intro}</p><div className="article-divider" /><div className="tutorial-tools"><button className="secondary" disabled={lessonBusy} onClick={generateLesson}>{lessonBusy ? "正在生成教程…" : lesson.contentReady === false ? "生成本节教程" : "重新生成教程"}</button>{lesson.prerequisites?.length ? <small>前置：{lesson.prerequisites.join("、")}</small> : null}</div><h2>理解这个概念</h2>{lesson.contentReady === false ? <p>点击「生成本节教程」，模型会根据你的目标与基础展开讲解。已编写的代码会保留。</p> : <TutorialText text={lesson.body} onCopy={copyCode} />}{lesson.examples?.map((example, i) => <section key={i} className="worked-example"><h2>例子 {i + 1}：{example.title}</h2>{example.run_instructions && <p>{example.run_instructions}</p>}<CopyCode code={example.code} title={example.title} onCopy={copyCode} />{example.expected_output && <><h3>你应该看到什么</h3><pre className="expected-output">{example.expected_output}</pre></>}{example.explanation && <><h3>这段代码为什么这样写</h3><TutorialText text={example.explanation} onCopy={copyCode} /></>}</section>)}{lesson.quality_note && <p className="inline-note">{lesson.quality_note}</p>}{lesson.learning_support && <><h2>常见问题怎么处理</h2>{lesson.learning_support.mistakes.map((item, i) => <p key={i}>{item}</p>)}</>}<div className="concept"><span>关键思考</span><p>这一步接收什么输入？输出应当是什么？怎样确认它按预期工作？</p></div><h2>动手练习</h2>{lesson.acceptance && <div className="lesson-note">完成标准：{lesson.acceptance}</div>}<p>{lesson.exercise || "生成本节教程后，这里将显示练习要求。"}</p>{lesson.learning_support ? <><h3>卡住时再看提示</h3>{lesson.learning_support.hints.map((hint, i) => <details className="lesson-hint" key={i}><summary>提示 {i+1}</summary><p>{hint}</p></details>)}<h2>检查自己是否真的懂了</h2>{lesson.learning_support.checks.map((check, i) => <section key={i}><p>{i+1}. {check.question}</p><details className="lesson-hint"><summary>展开答案与原因</summary><p>{check.answer}</p></details></section>)}</> : <p>先运行教程示例，再尝试修改。若旧教程缺少说明，可点击「重新生成教程」获取新版讲解。</p>}<div className="lesson-note">教程来自学习路线文件。导入已保存的路线后，可在目录中跳转并重读。</div><label className="completion"><input type="checkbox" checked={lesson.done} onChange={e => updateLesson({ done: e.target.checked })} />我已完成本节学习 <small>手动记录</small></label><div className="lesson-navigation"><button className="secondary" disabled={active === 0} onClick={() => setActive(active - 1)}>← 上一节</button><button className="primary" disabled={active === plan.lessons.length - 1} onClick={() => setActive(active + 1)}>下一节 →</button></div></article></section>
      {mod === 'programming' && <section className="coding"><div className="pane-heading"><span>编程台</span><div className="button-row"><span className="language">Python</span><button className="run-button" onClick={() => running ? runner.current?.abort() : void executeCode()}>{running ? "■ 停止" : "▶ 运行"}</button></div></div><div className="file-tabs"><span>⌘ main.py <i>●</i></span><small>本次会话</small></div><div className="monaco-area"><CodeEditor key={`${planEpoch.current}:${lesson.id}`} path={`file:///workspace/${planEpoch.current}/${encodeURIComponent(lesson.id)}/main.py`} value={lesson.code} onChange={code => updateLesson({ code })} onSelection={setSelectedCode} onAsk={askSelection} /></div>{selectedCode.trim() && <div className="selection-actions"><span>已选中 {selectedCode.split("\n").length} 行代码</span><button onClick={() => askSelection(selectedCode)}>✧ 询问选中代码</button></div>}<div className="code-status"><span>UTF-8 · Python · 本地隔离执行</span><button disabled={aiBusy} onClick={evaluate}>{aiBusy ? "AI 正在回答…" : "提交 AI 评估 ↗"}</button></div><div className="terminal"><div className="terminal-tabs">{['终端', '调试', '评估'].map(t => <button className={outputTab === t ? 'active' : ''} key={t} onClick={() => setOutputTab(t)}>{t}</button>)}<span>Python / WebAssembly</span></div><pre>{outputTab === '终端' ? terminal : outputTab === '调试' ? debugOutput : assessment}</pre></div></section>}
    </div>{assistantOpen && <aside className="chat-panel"><div className="chat-heading"><div><span>✧</span><strong>AI 学习助手<small>{provider} · {model || '请先配置模型'}</small></strong></div><button className="square-button" aria-label="关闭 AI 助手" onClick={() => setAssistantOpen(false)}>×</button></div><div className="chat-context">当前上下文：{lesson.title}</div><div className="chat-messages">{messages.map((m, i) => <div key={i} className={`chat-message ${m.role}`}><small>{m.role === 'assistant' ? '太极 · AI 助手' : '你'}</small><TutorialText text={m.text} onCopy={copyCode} /></div>)}{aiBusy && <div className="ai-thinking" role="status">模型正在回答…</div>}<div ref={chatEnd} /></div><div className="chat-compose">{questionCode && <div className="quoted-code"><div><span>引用的代码</span><button onClick={() => setQuestionCode('')}>移除</button></div><pre>{questionCode}</pre></div>}<button className="chat-suggestion" onClick={() => setMessage('给我一点提示，不要直接给答案')}>给我一点提示</button><form onSubmit={e => { e.preventDefault(); chat(); }}><textarea aria-label="给 AI 助手发送消息" rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="问一个问题，或讨论你的代码…" /><button className="send" disabled={!message.trim() || aiBusy} aria-label="发送消息">↑</button></form><small>发送时附带本节教程、当前代码和选中片段</small></div></aside>}</main>}
  </div>;
}
