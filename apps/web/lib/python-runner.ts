export type PythonResult = { stdout: string; stderr: string; error: string; durationMs: number };

// Each execution gets a fresh opaque-origin iframe and worker. No page state, API keys,
// host filesystem or network permissions are shared with submitted Python.
export function runPython(code: string, onStatus: (status: string) => void, signal?: AbortSignal): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.sandbox.add('allow-scripts');
    const token = crypto.randomUUID();
    const assets = `${location.origin}/runtime/`;
    let finished = false;
    let started = false;
    let timeout: ReturnType<typeof setTimeout>;
    const stop = () => finish(new Error('运行已停止。'));
    const cleanup = () => {
      clearTimeout(timeout);
      frame.contentWindow?.postMessage({ token, action: 'stop' }, '*');
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', stop);
      // Allow the iframe's UI thread to process worker.terminate before detaching.
      setTimeout(() => frame.remove(), 50);
    };
    const finish = (error?: Error, result?: PythonResult) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (error) reject(error); else resolve(result!);
    };
    function receive(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.data?.token !== token) return;
      if (event.data.type === 'ready') {
        if (started || finished) return;
        started = true;
        clearTimeout(timeout);
        onStatus('Python 运行中…');
        timeout = setTimeout(() => finish(new Error('运行超过 10 秒，已终止。请检查是否存在无限循环。')), 10000);
        frame.contentWindow?.postMessage({ token, action: 'run', code }, '*');
      } else if (event.data.type === 'result') {
        finish(undefined, event.data.result);
      } else if (event.data.type === 'error') {
        finish(new Error(event.data.error || 'Python 环境加载失败。'));
      }
    }
    const workerCode = `
      importScripts(${JSON.stringify(assets + 'pyodide.js')});
      let py;
      loadPyodide({indexURL: ${JSON.stringify(assets)}}).then(p => {py=p; postMessage({type:'ready'});}).catch(() => postMessage({type:'error',error:'Python 环境加载失败，请确认本地运行资源完整。'}));
      onmessage=async event=>{
        const output={stdout:'',stderr:'',error:'',durationMs:0};
        const begin=performance.now();
        let count=0;
        const append=(kind,text)=>{count+=text.length;if(count>60000)throw new Error('输出超过 60 KB，停止收集。');output[kind]+=text+'\\n';};
        py.setStdout({batched:text=>append('stdout',text)});
        py.setStderr({batched:text=>append('stderr',text)});
        py.setStdin({stdin:()=>{throw new Error('当前不支持 input() 交互输入，请在代码中直接赋值。');}});
        try { const value=await py.runPythonAsync(event.data.code); if(value!==undefined){append('stdout',String(value));if(value&&value.destroy)value.destroy();} }
        catch(error){
          const message=String(error).slice(0,12000);
          const match=message.match(/(?:^|\\n)SystemExit:\\s*0\\s*$/);
          if(error?.type === 'SystemExit' && match){
            output.stdout += '程序主动结束（退出码 0）。\\n';
          } else {
            output.error=message;
          }
        }
        output.durationMs=Math.round(performance.now()-begin);
        postMessage({type:'result',result:output});
      };
    `;
    const policy = `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${assets}; connect-src ${assets}; worker-src blob:; child-src blob:;`;
    const script = `
      const token=${JSON.stringify(token)};
      const blob=new Blob([${JSON.stringify(workerCode)}],{type:'application/javascript'});
      const url=URL.createObjectURL(blob);
      const worker=new Worker(url);
      worker.onmessage=e=>parent.postMessage({...e.data,token},'*');
      worker.onerror=()=>parent.postMessage({token,type:'error',error:'Python worker 启动失败。'},'*');
      onmessage=e=>{if(e.source!==parent||e.data?.token!==token)return;if(e.data.action==='stop'){worker.terminate();URL.revokeObjectURL(url);}else if(e.data.action==='run')worker.postMessage({code:e.data.code});};
    `;
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><script>${script.replace(/<\/script/gi, '<\\/script')}<\/script>`;
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', stop, { once: true });
    onStatus('正在加载本地 Python 环境…');
    timeout = setTimeout(() => finish(new Error('Python 环境加载超时，请刷新后重试。')), 60000);
    if (signal?.aborted) { stop(); return; }
    document.body.appendChild(frame);
  });
}
