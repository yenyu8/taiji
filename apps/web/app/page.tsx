'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Monaco = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PACK_ID = 'org.taiji.agent-developer';

type Skill = { id: string; title: string; description: string };
type Task = { id: string; title: string; description: string; starter_code: string; skill_id: string };
type Pack = { manifest: { name: string; version: string; id: string }; goal: { title: string; description: string; success_criteria: string }; skills: Skill[]; tasks: Task[]; scenes: { title: string; component_ids: string[] }[]; components: { id: string; title: string }[] };
type Evidence = { id: string; type: string; created_at: string; result: { passed: number; total: number; verified: boolean } };
type Progress = { skill_id: string; status: string; evidence_ids: string[] };
type Workspace = { installed: boolean; pack: Pack | null; evidence: Evidence[]; progress: Progress[] };
type RunResult = { mode: string; passed: number; total: number; checks: { id: string; label: string; passed: boolean }[]; message: string };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300));
  return res.json();
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [expert, setExpert] = useState(false);
  const [config, setConfig] = useState('');
  const [saved, setSaved] = useState(false);

  async function refresh() {
    const data: Workspace = await api('/api/workspace');
    setWorkspace(data);
    if (data.pack && !code) setCode(data.pack.tasks[0]?.starter_code || '');
    if (data.pack) setConfig(JSON.stringify({ goal: data.pack.goal, skills: data.pack.skills, tasks: data.pack.tasks, scenes: data.pack.scenes, components: data.pack.components }, null, 2));
  }
  useEffect(() => { refresh().catch(e => setError(`后端连接失败：${e.message}`)); }, []);
  async function installPack() {
    setBusy(true); setError('');
    try { await api(`/api/packs/${PACK_ID}/install`, { method: 'POST' }); await refresh(); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function runCode() {
    const task = workspace?.pack?.tasks[0]; if (!task) return;
    setBusy(true); setError('');
    try { const next = await api('/api/run', { method: 'POST', body: JSON.stringify({ task_id: task.id, code, hint_level: hintLevel }) }); setResult(next); await refresh(); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function saveConfig() {
    setBusy(true); setError(''); setSaved(false);
    try { await api(`/api/packs/${PACK_ID}/config`, { method: 'PUT', body: JSON.stringify(JSON.parse(config)) }); await refresh(); setSaved(true); }
    catch (e) { setError(`配置保存失败：${String(e)}`); } finally { setBusy(false); }
  }

  const pack = workspace?.pack;
  const task = pack?.tasks[0];
  const skill = pack?.skills[0];
  const progress = workspace?.progress[0];
  const hints = ['先读任务描述，自己想一种返回数据结构。', '函数需要接收 city 参数。', '返回值可以使用字典，包含两个键。', '思路：定义函数 → 组装字典 → return。', "可参考：return {'city': city, 'forecast': 'sunny'}", '完整答案会削弱独立完成的证据；此 Demo 不提供自动答案。'];

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">太</div><div><strong>元学 · Taiji</strong><span>Learning Core / v0.1</span></div></div>
      <div className="side-label">学习空间</div>
      <div className="side-item active">◈ <span>概览与训练</span></div>
      <div className="side-item" onClick={() => setExpert(!expert)}>◇ <span>{expert ? '返回普通模式' : '专家模式'}</span></div>
      <div className="side-bottom"><div className="status-dot" />本地 Demo <span className="mock-mini">MOCK RUNNER</span></div>
    </aside>
    <div className="content">
      <header className="topbar"><div><span className="eyebrow">TAIJI CORE DEMO</span><h1>把目标变成可以验证的练习</h1><p>从官方学习包开始，写代码、查看反馈，再留下可追溯的学习证据。</p></div><button className="mode" onClick={() => setExpert(!expert)}>{expert ? '普通模式' : '专家模式'} <span>↗</span></button></header>
      {error && <div className="error">{error}</div>}
      {!workspace && <div className="card">正在连接学习空间…</div>}
      {workspace && !workspace.installed && <section className="welcome card"><div className="welcome-icon">⌘</div><span className="eyebrow">OFFICIAL LEARNING PACK</span><h2>Agent Developer Starter</h2><p>加载一个官方学习包，进入编程训练场。Demo 包含一个目标、一项能力和一个练习任务。</p><button className="primary" disabled={busy} onClick={installPack}>{busy ? '正在加载…' : '一键加载官方学习包'} <span>→</span></button></section>}
      {pack && <>
        <div className="overview">
          <section className="card goal"><div className="section-heading"><span className="eyebrow">01 / GOAL</span><span className="pill">当前目标</span></div><h2>{pack.goal.title}</h2><p>{pack.goal.description}</p><div className="card-foot">成功标准 <span>{pack.goal.success_criteria}</span></div></section>
          <section className="card skill"><div className="section-heading"><span className="eyebrow">02 / SKILL</span><span className="pill violet">能力</span></div><h2>{skill?.title}</h2><p>{skill?.description}</p><div className="progress-track"><div style={{ width: progress?.status === 'mock_passed' ? '100%' : progress?.status === 'practicing' ? '35%' : '0%' }} /></div><div className="small-row"><span>学习状态</span><strong>{progress?.status === 'mock_passed' ? '模拟检查通过' : progress?.status === 'practicing' ? '练习中' : '尚未开始'}</strong></div></section>
        </div>
        <section className="workspace-card card"><div className="workspace-head"><div><span className="eyebrow">03 / CURRENT TASK</span><h2>{task?.title}</h2><p>{task?.description}</p></div><span className="pill">{pack.scenes[0]?.title}</span></div>
          <div className="work-grid"><div className="editor-zone"><div className="panel-head"><span><b className="file-dot" /> main.py</span><span>CODE EDITOR</span></div><div className="editor"><Monaco height="320px" language="python" theme="vs-dark" value={code} onChange={value => setCode(value || '')} options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 18 }, scrollBeyondLastLine: false }} /></div><div className="editor-bottom"><span>代码只用于模拟检查，不会被执行</span><button className="primary" disabled={busy} onClick={runCode}>{busy ? '检查中…' : '运行 / 测试'} <span>▶</span></button></div></div>
          <div className="right-panels"><div className="mini-panel"><div className="panel-head"><span>运行 / 测试结果</span><span>MOCK</span></div>{result ? <div className="result"><strong>{result.passed} / {result.total} 项模拟检查满足</strong><p>{result.message}</p>{result.checks.map(check => <div className="check" key={check.id}><span className={check.passed ? 'pass' : 'fail'}>{check.passed ? '✓' : '×'}</span>{check.label}</div>)}</div> : <div className="empty">点击“运行 / 测试”查看模拟反馈。</div>}</div><div className="mini-panel tutor"><div className="panel-head"><span>AI Tutor</span><span>占位 · 分级提示</span></div><p>{hints[hintLevel]}</p><div className="hint-controls"><span>提示级别 {hintLevel} / 5</span><button onClick={() => setHintLevel(Math.min(5, hintLevel + 1))}>下一条提示 →</button></div></div></div></div>
        </section>
        <div className="overview lower"><section className="card"><div className="section-heading"><span className="eyebrow">04 / EVIDENCE</span><span className="pill">{workspace?.evidence.length} 条记录</span></div><h2>学习证据</h2>{workspace?.evidence.length ? <div className="evidence-list">{workspace.evidence.slice(0, 4).map(item => <div key={item.id} className="evidence-row"><span className="evidence-icon">◈</span><div><strong>模拟检查 {item.result.passed}/{item.result.total}</strong><small>{new Date(item.created_at).toLocaleString('zh-CN')} · {item.type}</small></div><span className="mock-mini">未真实验证</span></div>)}</div> : <p>完成一次练习后，这里会记录检查结果和时间。</p>}</section><section className="card"><div className="section-heading"><span className="eyebrow">05 / PROGRESS</span><span className="pill violet">Evidence → SkillState</span></div><h2>学习进度</h2><p>当前能力：{skill?.title}</p><div className="progress-detail"><span>状态</span><strong>{progress?.status === 'mock_passed' ? '模拟检查通过，待真实验证' : progress?.status === 'practicing' ? '练习中' : '尚未开始'}</strong></div><div className="progress-detail"><span>关联证据</span><strong>{progress?.evidence_ids.length || 0} 条</strong></div></section></div>
        {expert && <section className="card expert"><div className="section-heading"><span className="eyebrow">EXPERT MODE</span><span className="pill">同一份学习包配置</span></div><h2>编辑学习包计划</h2><p>这里编辑 Goal、Skill、Task、Scene 和 Component 的声明式配置。保存后普通模式立即读取同一份配置；不能上传或执行 Mod 代码。</p><div className="manifest"><strong>{pack.manifest.id}</strong><span>v{pack.manifest.version} · {pack.manifest.name}</span></div><textarea spellCheck={false} value={config} onChange={e => { setConfig(e.target.value); setSaved(false); }} /><div className="expert-actions"><button className="primary" disabled={busy} onClick={saveConfig}>保存配置</button>{saved && <span>已保存</span>}</div></section>}
      </>}
      <footer>Taiji Core v0.1 · 官方 Agent Developer Demo · 本地运行</footer>
    </div>
  </main>;
}
