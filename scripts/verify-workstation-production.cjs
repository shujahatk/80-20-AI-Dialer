/**
 * Direct Chrome DevTools Protocol (CDP) Script to verify live production Workstation
 * Validates that lead Shujahat Khan no longer displays the stuck call error banner,
 * that the call status is clean and ready, and captures a full-resolution verification screenshot.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\8653c4bf-8000-497b-9f56-9219f027124a';
const SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'production-workstation-reconciled-verified.png');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9225; // Use dedicated port

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id && this.pending.has(msg.id)) {
          const { res, rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { res: resolve, rej: reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function run() {
  console.log('1. Launching Headless Chrome on port', DEBUG_PORT);
  const tmpProfile = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_cdp_workstation_' + Date.now());

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tmpProfile}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'about:blank',
  ], { detached: true, stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (version && version.webSocketDebuggerUrl) {
        wsUrl = version.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    throw new Error('Failed to connect to Chrome debugging port.');
  }

  console.log('2. Connected to Chrome CDP.');
  const client = new CDPClient(wsUrl);
  await client.connect();

  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const tabWsUrl = `ws://127.0.0.1:${DEBUG_PORT}/devtools/page/${targetId}`;
  const tabClient = new CDPClient(tabWsUrl);
  await tabClient.connect();

  await tabClient.send('Page.enable');
  await tabClient.send('Runtime.enable');
  await tabClient.send('DOM.enable');

  await tabClient.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('3. Navigating to login page with redirect to Workstation for Shujahat Khan...');
  const workstationUrl = 'https://80-20-ai-dialer.vercel.app/workstation?leadId=5e36899f-75cf-4cbf-ba55-6881be52e089';
  await tabClient.send('Page.navigate', {
    url: `https://80-20-ai-dialer.vercel.app/login?redirectTo=${encodeURIComponent(workstationUrl)}`,
  });
  await sleep(4000);

  console.log('4. Submitting Sign In form...');
  const submitRes = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const btn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign In'));
        if (btn) {
          btn.click();
          return 'Clicked Sign In';
        }
        return 'Sign In button not found';
      })()
    `,
    returnByValue: true,
  });
  console.log('Submit Result:', submitRes.result.value);

  // Wait for authentication and navigation to Workstation
  await sleep(6000);

  // If still on login or redirected elsewhere, navigate directly to workstationUrl
  const currentUrl = await tabClient.send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true,
  });
  console.log('Current URL after sign-in:', currentUrl.result.value);

  if (!currentUrl.result.value.includes('/workstation')) {
    console.log('Navigating directly to Workstation...');
    await tabClient.send('Page.navigate', { url: workstationUrl });
    await sleep(5000);
  }

  // Inspect Workstation UI content
  console.log('5. Inspecting Workstation state for Shujahat Khan...');
  const inspection = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const text = document.body.innerText;
        const hasShujahat = text.includes('Shujahat') || text.includes('Khan');
        const hasStuckError = text.includes('already has an active call in progress') || text.includes('34cceea3');
        const hasStartCallBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Start Call') || b.innerText.includes('Call Lead'));
        const hasFailedBanner = text.includes('Call status: FAILED') || text.includes('Call Failed');
        const hasReconcileBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Reconcile'));

        // Capture visible status pills/text
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, span, div')).filter(el => el.children.length === 0 && el.innerText.trim().length > 0).map(el => el.innerText.trim()).slice(0, 30);

        return {
          url: window.location.href,
          hasShujahat,
          hasStuckError,
          hasStartCallBtn,
          hasFailedBanner,
          hasReconcileBtn,
          sampleText: headings.slice(0, 15),
          fullBodySnippet: text.slice(0, 500)
        };
      })()
    `,
    returnByValue: true,
  });

  console.log('\n--- WORKSTATION INSPECTION RESULT ---');
  console.log('URL:', inspection.result.value.url);
  console.log('Has Shujahat Khan:', inspection.result.value.hasShujahat);
  console.log('Has Stuck Error Banner:', inspection.result.value.hasStuckError);
  console.log('Has Start Call Button:', inspection.result.value.hasStartCallBtn);
  console.log('Has Failed Status Banner:', inspection.result.value.hasFailedBanner);
  console.log('Has Reconcile Button Available:', inspection.result.value.hasReconcileBtn);
  console.log('Sample Headings:', inspection.result.value.sampleText);

  // Capture full resolution screenshot
  console.log('\n6. Capturing full-page verification screenshot...');
  const screenshotData = await tabClient.send('Page.captureScreenshot', {
    format: 'png',
    quality: 100,
  });

  fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(screenshotData.data, 'base64'));
  console.log('Screenshot saved successfully to:', SCREENSHOT_PATH);

  try {
    process.kill(chromeProc.pid);
  } catch {}

  console.log('\n=== VERIFICATION COMPLETE ===');
}

run().catch((err) => {
  console.error('Workstation verification failed:', err);
  process.exit(1);
});
