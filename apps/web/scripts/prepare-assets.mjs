import { mkdir, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await mkdir(path.join(root, 'public/runtime'), { recursive: true });
for (const file of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(path.join(root, 'node_modules/pyodide', file), path.join(root, 'public/runtime', file));
}
await mkdir(path.join(root, 'public/monaco'), { recursive: true });
await cp(path.join(root, 'node_modules/monaco-editor/min/vs'), path.join(root, 'public/monaco/vs'), { recursive: true });
console.log('Local Python runtime and Monaco editor assets prepared.');
