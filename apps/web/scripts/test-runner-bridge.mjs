import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('lib/python-runner.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness() {
  let receive, frameContext, worker;
  let timerId = 0;
  const timers = new Map(), sandboxTokens = [], workerSources = new Map();
  const frame = { sandbox: { add: token => sandboxTokens.push(token) }, remove() { this.removed = true; },
    contentWindow: { postMessage: data => frameContext.onmessage({ source: frameContext.parent, data }) } };
  class Blob { constructor(parts) { this.source = parts.join(''); } }
  class Worker {
    constructor(url) { worker = this; this.source = workerSources.get(url); new vm.Script(this.source); this.sent = []; }
    postMessage(data) { this.sent.push(data); }
    terminate() { this.terminated = true; }
  }
  const testContext = { exports: {}, crypto: webcrypto, location: { origin: 'http://127.0.0.1:3000' },
    setTimeout(fn, ms) { if (ms === 50) { fn(); return 0; } timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    window: { addEventListener(type, fn) { receive = fn; }, removeEventListener() { receive = null; } },
    document: { createElement() { return frame; }, body: { appendChild() {
      assert.ok(frame.srcdoc.includes("default-src 'none'"));
      assert.ok(!frame.srcdoc.includes('allow-same-origin'));
      assert.ok(frame.srcdoc.includes('connect-src http://127.0.0.1:3000/runtime/;'));
      const script = frame.srcdoc.match(/<script>([\s\S]*)<\/script>/)?.[1];
      assert.ok(script, 'Iframe has a complete script element');
      frameContext = { Blob, Worker, URL: { createObjectURL(blob) { workerSources.set('blob:null/test', blob.source); return 'blob:null/test'; }, revokeObjectURL() {} },
        parent: { postMessage(data) { receive?.({ source: frame.contentWindow, data }); } } };
      vm.runInNewContext(script, frameContext);
    } } },
  };
  vm.runInNewContext(compiled, testContext);
  return { run: testContext.exports.runPython, frame, timers, sandboxTokens, get worker() { return worker; } };
}

const normal = harness();
const result = normal.run('print(42)', () => {});
assert.deepEqual(normal.sandboxTokens, ['allow-scripts']);
normal.worker.onmessage({ data: { type: 'ready' } });
assert.equal(normal.worker.sent[0].code, 'print(42)');
normal.worker.onmessage({ data: { type: 'ready' } });
assert.equal(normal.worker.sent.length, 1, 'A worker cannot restart the timeout by sending ready again');
normal.worker.onmessage({ data: { type: 'result', result: { stdout: '42\n', stderr: '', error: '', durationMs: 1 } } });
assert.equal((await result).stdout, '42\n');
assert.equal(normal.worker.terminated, true);
assert.equal(normal.frame.removed, true);

const cancel = harness();
const controller = new AbortController();
const cancelled = cancel.run('while True: pass', () => {}, controller.signal);
controller.abort();
await assert.rejects(cancelled, /运行已停止/);
assert.equal(cancel.worker.terminated, true);

const timed = harness();
const pending = timed.run('while True: pass', () => {});
timed.worker.onmessage({ data: { type: 'ready' } });
const deadline = [...timed.timers.values()].find(t => t.ms === 10000);
assert.ok(deadline);
deadline.fn();
await assert.rejects(pending, /超过 10 秒/);
assert.equal(timed.worker.terminated, true);
console.log('PASS: runner bridge scripts parse, scoped CSP, message flow, cancellation and timeout lifecycle');
console.log('Note: this bridge test simulates browser messaging; it does not replace browser CSP/visual verification.');
