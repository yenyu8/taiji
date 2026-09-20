import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { loadPyodide } from 'pyodide';

const source = readFileSync('lib/learning-plan.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} }; vm.runInNewContext(compiled, context);
const { normalizePlan } = context.exports;
const bundle = { kind: 'learn-everything.roadmap', schema_version: 1,
  project: { title: '函数', goal: '实现函数', background: '零基础', weekly_hours: 5 },
  roadmap: { summary: '函数', stages: [{ name: '基础', stage: 'base', goal: '练习' }], nodes: [
    { code: '1.1', title: '参数', description: '说明', stage: 'base', prerequisites: [] },
    { code: '1.2', title: '返回', description: '说明', stage: 'base', prerequisites: ['1.1'] },
  ] } };
const plan = normalizePlan(bundle);
assert.equal(plan.lessons[1].prerequisites[0], '1.1');
plan.lessons[0].learning_support = {mistakes:['检查括号'],hints:['先改数字'],checks:[{question:'结果是什么',answer:'输出42'}]};
plan.lessons[0].quality_note = '语法已检查';
plan.api_key = 'never-export';
plan.lessons[0].code = 'print(42)';
plan.lessons[0].examples = [{ title: '代码', language: 'python', code: 'print(1)' }];
const exported = JSON.stringify(normalizePlan(plan));
assert.ok(!exported.includes('never-export'));
assert.equal(normalizePlan(JSON.parse(exported)).lessons[0].code, 'print(42)');
assert.equal(normalizePlan(JSON.parse(exported)).lessons[0].examples[0].code, 'print(1)');
const broken = structuredClone(bundle); broken.roadmap.nodes[0].prerequisites = ['1.2'];
assert.throws(() => normalizePlan(broken), /循环依赖/);
assert.throws(() => normalizePlan({ version: 1, lessons: [null] }));
const enriched = context.exports.fromRoadmap({ summary: '练习路线', stages: [{name:'基础',stage:'base',goal:'独立写函数'}], nodes: [{code:'a',title:'函数',description:'说明',stage:'base',est_hours:2,difficulty:1,prerequisites:[],outcome:'写函数',practice:'写加法',acceptance:'2+3输出5'}]}, '目标', '基础', '每周 5 小时', undefined, {changes:['补练习'],concerns:[],total_hours:999,estimated_weeks:999,structure_checked:true,auto_repaired:false});
const restored = normalizePlan(JSON.parse(JSON.stringify(enriched)));
assert.equal(restored.lessons[0].acceptance, '2+3输出5');
assert.equal(restored.lessons[0].exercise, '写加法');
assert.equal(restored.quality.total_hours, 2);
assert.equal(context.exports.toRoadmap(restored).nodes[0].outcome, '写函数');
assert.equal(normalizePlan(JSON.parse(exported)).lessons[0].learning_support.checks[0].answer, '输出42');
console.log('PASS: Learn Everything import, export roundtrip, key exclusion, invalid/cyclic graph rejection');

// Execute only these fixed test fixtures under Node; submitted user code uses the browser sandbox.
const python = await loadPyodide({ indexURL: path.resolve('node_modules/pyodide') });
let output = '';
python.setStdout({ batched: text => output += text + '\n' });
await python.runPythonAsync('import json\ndef weather_tool(city):\n    return {"city": city, "forecast": "sunny"}\nprint(json.dumps(weather_tool("Beijing")))');
assert.equal(JSON.parse(output).city, 'Beijing');
await assert.rejects(() => python.runPythonAsync('def broken('), /SyntaxError/);
await assert.rejects(() => python.runPythonAsync('1 / 0'), /ZeroDivisionError/);
console.log('PASS: bundled Python runtime, function execution, stdout, syntax and runtime exceptions');
