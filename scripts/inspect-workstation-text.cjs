const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9227;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fetchJson(url) {
  return new Promise((res, rej) => http.get(url, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));
}

class CDPClient {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.msgId = 0; this.pending = new Map(); }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', res);
      this.ws.on('error', rej);
      this.ws.on('message', data => {
        const msg = JSON.parse(data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

(async () => {
  const tmpProfile = 'C:\\Temp\\chrome_cdp_inspect_' + Date.now();
  const proc = spawn(CHROME_PATH, ['--headless=new', '--remote-debugging-port=' + DEBUG_PORT, '--remote-allow-origins=*', '--user-data-dir=' + tmpProfile, 'about:blank'], { detached: true, stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try { const v = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json/version'); if (v?.webSocketDebuggerUrl) { wsUrl = v.webSocketDebuggerUrl; break; } } catch {}
  }
  const client = new CDPClient(wsUrl);
  await client.connect();
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const tab = new CDPClient('ws://127.0.0.1:' + DEBUG_PORT + '/devtools/page/' + targetId);
  await tab.connect();
  await tab.send('Page.enable');
  await tab.send('Runtime.enable');
  await tab.send('Page.navigate', { url: 'https://80-20-ai-dialer.vercel.app/login' });
  await sleep(3500);
  await tab.send('Runtime.evaluate', { expression: "document.querySelector('button[type=submit]')?.click()" });
  await sleep(4000);
  await tab.send('Page.navigate', { url: 'https://80-20-ai-dialer.vercel.app/workstation?leadId=5e36899f-75cf-4cbf-ba55-6881be52e089' });
  await sleep(6000);

  const textRes = await tab.send('Runtime.evaluate', {
    expression: 'document.body.innerText',
    returnByValue: true
  });
  console.log('--- WORKSTATION TEXT ---');
  console.log(textRes.result.value);

  process.kill(proc.pid);
})();
