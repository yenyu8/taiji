export type Example = { title: string; language: string; code: string; explanation?: string; expected_output?: string; run_instructions?: string };
export type LearningSupport = { mistakes: string[]; hints: string[]; checks: { question: string; answer: string }[] };
export type Lesson = { id: string; title: string; phase: string; intro: string; body: string; exercise: string; code: string; done: boolean;
  learning_support?: LearningSupport; quality_note?: string; outcome?: string; acceptance?: string; phaseGoal?: string; examples?: Example[]; prerequisites?: string[]; est_hours?: number; difficulty?: number; contentReady?: boolean };
export type Provenance = { model: string; provider: string; prompt_version: string; generated_at: string; ai_reviewed: boolean; human_reviewed: boolean };
export type Quality = { changes: string[]; concerns: string[]; total_hours: number; estimated_weeks: number; structure_checked: boolean; auto_repaired: boolean };
export type Plan = { version: 1; title: string; goal: string; level: string; hours: string; lessons: Lesson[]; learningPreferences?: string; provenance?: Provenance; quality?: Quality };
export type Roadmap = { summary: string; stages: { name: string; stage: string; goal: string }[];
  nodes: { code: string; title: string; description: string; stage: string; est_hours: number; difficulty: number; prerequisites: string[]; outcome?: string; practice?: string; acceptance?: string }[] };
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('内容必须是 JSON 对象'); return value as Record<string, unknown>; }
function text(value: unknown, max = 24000): string { if (typeof value !== 'string' || value.length > max) throw new Error('文本字段格式或长度不正确'); return value; }
function validateDependencies(lessons: Lesson[]) {
  const nodes = new Map(lessons.map(l => [l.id, l]));
  if (nodes.size !== lessons.length || lessons.some(l => !l.id.trim())) throw new Error('章节 ID 重复或为空');
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('路线存在循环依赖');
    if (visited.has(id)) return;
    const node = nodes.get(id); if (!node) throw new Error('路线引用了不存在的前置章节');
    visiting.add(id); (node.prerequisites || []).forEach(visit); visiting.delete(id); visited.add(id);
  }
  lessons.forEach(l => visit(l.id));
}
export function fromRoadmap(roadmap: Roadmap, goal: string, level: string, hours: string, provenance?: Provenance, quality?: Quality): Plan {
  const stages = new Map(roadmap.stages.map(s => [s.stage, s.name]));
  const plan: Plan = { version: 1, title: roadmap.summary.slice(0, 80), goal, level, hours,
    lessons: roadmap.nodes.map(n => ({ id: n.code, title: n.title, phase: stages.get(n.stage) || n.stage,
      intro: n.description, body: '', exercise: n.practice || '', outcome: n.outcome || '', acceptance: n.acceptance || '', phaseGoal: roadmap.stages.find(s => s.stage === n.stage)?.goal || '', code: '', done: false, prerequisites: n.prerequisites,
      est_hours: n.est_hours, difficulty: n.difficulty, contentReady: false, examples: [] })), provenance, quality };
  return normalizePlan(plan);
}
export function normalizePlan(value: unknown): Plan {
  const data = object(value);
  if (data.kind === 'learn-everything.roadmap' || Array.isArray(data.nodes)) {
    if (data.kind && data.schema_version !== 1) throw new Error('暂不支持此 Learn Everything 文件版本');
    const roadmap = object(data.roadmap || data);
    const project = object(data.project || {});
    if (!Array.isArray(roadmap.nodes) || !roadmap.nodes.length || roadmap.nodes.length > 100) throw new Error('路线需包含 1 至 100 个节点');
    const nodes = roadmap.nodes.map(v => { const n = object(v); return {
      code: text(n.code, 60), title: text(n.title, 200), description: text(n.description || ''), stage: text(n.stage || 'base', 60),
      est_hours: typeof n.est_hours === 'number' ? n.est_hours : 2, difficulty: typeof n.difficulty === 'number' ? n.difficulty : 1,
      prerequisites: Array.isArray(n.prerequisites) ? n.prerequisites.map(x => text(x, 60)) : [],
    }; });
    const stages = Array.isArray(roadmap.stages) ? roadmap.stages.map(v => { const s = object(v); return { name: text(s.name || s.stage, 100), stage: text(s.stage, 60), goal: text(s.goal || '') }; })
      : Array.from(new Set(nodes.map(n => n.stage))).map(stage => ({ stage, name: stage, goal: '' }));
    return fromRoadmap({ summary: text(project.title || roadmap.summary || '导入的学习路线', 2000), nodes, stages }, text(project.goal || ''), text(project.background || '未填写'), `每周 ${Number(project.weekly_hours) || 5} 小时`);
  }
  if (data.version !== 1 || !Array.isArray(data.lessons) || !data.lessons.length || data.lessons.length > 100) throw new Error('不是支持的太极学习文件');
  const lessons = data.lessons.map(v => { const l = object(v);
    if (typeof l.done !== 'boolean') throw new Error('学习状态不正确');
    const examples = l.examples === undefined ? [] : (() => {
      if (!Array.isArray(l.examples) || l.examples.length > 6) throw new Error('示例代码格式不正确');
      return l.examples.map(x => { const e = object(x); return { title: text(e.title, 200), language: text(e.language, 30), code: text(e.code, 20000), explanation: text(e.explanation || '', 6000), expected_output: text(e.expected_output || '', 3000), run_instructions: text(e.run_instructions || '', 2000) }; });
    })();
    const lesson: Lesson = { id: text(l.id, 60), title: text(l.title, 200), phase: text(l.phase, 100), intro: text(l.intro), body: text(l.body),
      exercise: text(l.exercise, 4000), code: text(l.code, 20000), done: l.done, examples, outcome: text(l.outcome || '', 1000), acceptance: text(l.acceptance || '', 1500), phaseGoal: text(l.phaseGoal || '', 1000),
      prerequisites: Array.isArray(l.prerequisites) ? l.prerequisites.map(x => text(x, 60)) : [], contentReady: l.contentReady !== false };
    if (typeof l.est_hours === 'number' && l.est_hours > 0 && l.est_hours <= 100) lesson.est_hours = l.est_hours;
    if (typeof l.difficulty === 'number' && l.difficulty >= 1 && l.difficulty <= 5) lesson.difficulty = l.difficulty;
    if (l.learning_support) {
      const support = object(l.learning_support);
      if (!Array.isArray(support.mistakes) || !Array.isArray(support.hints) || !Array.isArray(support.checks) || support.mistakes.length > 6 || support.hints.length > 4 || support.checks.length > 5) throw new Error('学习提示格式不正确');
      lesson.learning_support = { mistakes: support.mistakes.map(x => text(x, 3000)), hints: support.hints.map(x => text(x, 3000)), checks: support.checks.map(x => { const c = object(x); return {question:text(c.question,1000),answer:text(c.answer,2000)}; }) };
    }
    if (l.quality_note) lesson.quality_note = text(l.quality_note, 1000);
    return lesson;
  });
  validateDependencies(lessons);
  const plan: Plan = { version: 1, title: text(data.title, 200), goal: text(data.goal, 4000), level: text(data.level, 4000), hours: text(data.hours, 100), lessons };
  if (data.learningPreferences) plan.learningPreferences = text(data.learningPreferences, 2000);
  if (data.provenance) { const p = object(data.provenance); plan.provenance = { model: text(p.model, 200), provider: text(p.provider, 500), prompt_version: text(p.prompt_version, 100), generated_at: text(p.generated_at, 100), ai_reviewed: p.ai_reviewed === true, human_reviewed: p.human_reviewed === true }; }
  if (data.quality) {
    const q = object(data.quality);
    if (!Array.isArray(q.changes) || !Array.isArray(q.concerns) || q.changes.length > 12 || q.concerns.length > 12) throw new Error('路线复核说明不正确');
    const total = lessons.reduce((sum, lesson) => sum + (lesson.est_hours || 0), 0);
    plan.quality = { changes: q.changes.map(x => text(x, 3000)), concerns: q.concerns.map(x => text(x, 3000)), total_hours: Math.round(total * 10) / 10,
      estimated_weeks: Math.round(total / (Number(plan.hours.match(/\d+/)?.[0]) || 5) * 10) / 10,
      structure_checked: q.structure_checked === true, auto_repaired: q.auto_repaired === true };
  }
  return plan;
}

export function toRoadmap(plan: Plan): Roadmap {
  const names = Array.from(new Set(plan.lessons.map(lesson => lesson.phase)));
  return { summary: plan.title,
    stages: names.map((name, index) => ({ name, stage: `stage-${index + 1}`, goal: plan.lessons.find(l => l.phase === name)?.phaseGoal || name })),
    nodes: plan.lessons.map(l => ({ code: l.id, title: l.title, description: l.intro, stage: `stage-${names.indexOf(l.phase) + 1}`,
      est_hours: l.est_hours || 2, difficulty: l.difficulty || 1, prerequisites: l.prerequisites || [], outcome: l.outcome || '', practice: l.exercise, acceptance: l.acceptance || '' })) };
}
