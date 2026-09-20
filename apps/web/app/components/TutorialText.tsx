'use client';
export function CopyCode({ code, title = 'Python 示例', onCopy }: { code: string; title?: string; onCopy: (code: string) => void }) {
  return <div className="tutorial-code"><div><span>{title}</span><button onClick={() => onCopy(code)}>复制代码</button></div><pre><code>{code}</code></pre></div>;
}
export default function TutorialText({ text, onCopy }: { text: string; onCopy: (code: string) => void }) {
  // Render plain text and fenced code as React nodes. Never execute generated HTML.
  return <>{text.split(/(```[\s\S]*?```)/g).map((part, i) => {
    if (part.startsWith('```')) { const lines = part.slice(3, -3).split('\n'); const language = lines.shift(); return <CopyCode key={i} title={language || '代码示例'} code={lines.join('\n').trimEnd()} onCopy={onCopy} />; }
    return <div className="tutorial-prose" key={i}>{part.split(/\n\s*\n/).map((p, j) => { const lines = p.split('\n'); if (lines[0].startsWith('## ')) return <section key={j}><h2>{lines[0].slice(3)}</h2><p>{lines.slice(1).join('\n')}</p></section>; return <p key={j}>{p}</p>; })}</div>;
  })}</>;
}
