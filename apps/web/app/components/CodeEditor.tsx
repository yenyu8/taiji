'use client';
import Editor, { loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef } from 'react';
loader.config({ paths: { vs: '/monaco/vs' } });

export default function CodeEditor({ value, path, onChange, onSelection, onAsk }: {
  value: string; path: string; onChange: (value: string) => void;
  onSelection: (value: string) => void; onAsk: (value: string) => void;
}) {
  const callbacks = useRef({ onSelection, onAsk });
  callbacks.current = { onSelection, onAsk };
  function mount(instance: editor.IStandaloneCodeEditor) {
    const selected = () => { const selection = instance.getSelection(); return selection ? instance.getModel()?.getValueInRange(selection) || '' : ''; };
    const subscription = instance.onDidChangeCursorSelection(() => callbacks.current.onSelection(selected()));
    const action = instance.addAction({ id: 'taiji.ask-selection', label: '向 AI 提问：选中的代码', contextMenuGroupId: 'navigation', contextMenuOrder: 1,
      run: () => { const text = selected(); if (text.trim()) callbacks.current.onAsk(text); }, });
    instance.onDidDispose(() => { subscription.dispose(); action.dispose(); });
  }
  return <Editor path={path} value={value} language="python" theme="light" onMount={mount}
    onChange={v => onChange(v || '')} loading={<div className="editor-loading">正在加载代码编辑器…</div>}
    options={{ fontSize: 13, lineHeight: 24, minimap: { enabled: false }, padding: { top: 20 }, scrollBeyondLastLine: false,
      automaticLayout: true, tabSize: 4, wordWrap: 'on', contextmenu: true, ariaLabel: 'Python 代码编辑器', fixedOverflowWidgets: true }} />;
}
