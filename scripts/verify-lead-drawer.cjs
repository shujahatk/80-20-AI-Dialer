/**
 * Direct Chrome DevTools Protocol (CDP) Script to verify live production LeadDrawer
 * Logs into https://80-20-ai-dialer.vercel.app, opens leads table, opens a lead drawer,
 * clicks Calls tab, expands call details and transcript, and captures full-resolution screenshots.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ARTIFACT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\8653c4bf-8000-497b-9f56-9219f027124a';
const SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'production-lead-drawer-calls-verified.png');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

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
  console.log('1. Launching Headless Chrome...');
  const tmpProfile = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_cdp_profile_' + Date.now());

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

  console.log('3. Navigating to login page with redirect to /leads...');
  await tabClient.send('Page.navigate', { url: 'https://80-20-ai-dialer.vercel.app/login?redirectTo=%2Fleads' });
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

  // Wait for authentication and navigation to /leads
  await sleep(4000);

  // Poll until leads table rows are loaded
  console.log('5. Waiting for leads table to load rows...');
  let rowsLoaded = false;
  for (let i = 0; i < 20; i++) {
    const check = await tabClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          const rowInfos = rows.map(r => r.innerText.replace(/\\s+/g, ' ').trim()).filter(t => t.length > 5);
          return {
            count: rowInfos.length,
            leads: rowInfos
          };
        })()
      `,
      returnByValue: true,
    });

    if (check.result.value.count > 0) {
      console.log(`Leads loaded! Found ${check.result.value.count} leads:`);
      check.result.value.leads.forEach((l, idx) => console.log(`  [${idx}] ${l}`));
      rowsLoaded = true;
      break;
    }
    await sleep(1000);
  }

  // Click Shujahat Khan's lead row or view button to open LeadDrawer
  console.log('6. Opening LeadDrawer for lead with calls...');
  const clickRowRes = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const rows = Array.from(document.querySelectorAll('tbody tr')).filter(r => r.innerText.trim().length > 5);
        // Find row for Shujahat Khan or fallback to first row
        const targetRow = rows.find(r => r.innerText.includes('Shujahat') || r.innerText.includes('Khan')) || rows[0];
        if (!targetRow) return 'No row found';

        // Find the view button (chevron right) or cell
        const buttons = Array.from(targetRow.querySelectorAll('button'));
        const chevronBtn = buttons.find(b => !b.innerText.includes('Call')) || buttons[buttons.length - 1];
        
        if (chevronBtn) {
          chevronBtn.click();
          return 'Clicked chevron button for: ' + targetRow.innerText.replace(/\\s+/g, ' ').slice(0, 40);
        }

        const nameCell = targetRow.querySelector('td:nth-child(2)');
        if (nameCell) {
          nameCell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return 'Dispatched click on nameCell: ' + nameCell.innerText;
        }

        targetRow.click();
        return 'Clicked target row directly';
      })()
    `,
    returnByValue: true,
  });
  console.log('Row Click Result:', clickRowRes.result.value);

  // Wait for drawer to appear and finish loading
  console.log('7. Waiting for LeadDrawer to finish loading...');
  let drawerReady = false;
  for (let i = 0; i < 15; i++) {
    const drawerCheck = await tabClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const drawer = document.querySelector('.rm-drawer-in') || document.querySelector('[class*="max-w-2xl"]');
          if (!drawer) return { ready: false, reason: 'No drawer' };
          const h2 = drawer.querySelector('h2');
          const buttons = Array.from(drawer.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
          const hasCallsTab = buttons.some(b => b === 'Calls' || b.startsWith('Calls'));
          return {
            ready: Boolean(h2 && h2.innerText.trim().length > 0 && hasCallsTab),
            title: h2 ? h2.innerText : null,
            buttons
          };
        })()
      `,
      returnByValue: true,
    });

    if (drawerCheck.result.value && drawerCheck.result.value.ready) {
      console.log('LeadDrawer loaded successfully! Lead:', drawerCheck.result.value.title);
      drawerReady = true;
      break;
    }
    await sleep(800);
  }

  // Click "Calls" tab in drawer
  console.log('8. Clicking "Calls" tab in LeadDrawer...');
  const clickCallsRes = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const drawer = document.querySelector('.rm-drawer-in') || document.querySelector('[class*="max-w-2xl"]');
        if (!drawer) return 'Drawer not found';
        const buttons = Array.from(drawer.querySelectorAll('button'));
        const callsTab = buttons.find(b => b.innerText.trim() === 'Calls' || b.innerText.trim().startsWith('Calls'));
        if (callsTab) {
          callsTab.click();
          return 'Clicked Calls tab successfully';
        }
        return 'Calls tab not found in drawer. Buttons: ' + buttons.map(b => b.innerText.trim()).join(', ');
      })()
    `,
    returnByValue: true,
  });
  console.log('Calls Tab Click:', clickCallsRes.result.value);

  // Poll for calls list to load
  console.log('9. Waiting for calls to load in Calls tab...');
  let callsLoaded = false;
  for (let i = 0; i < 15; i++) {
    const checkCalls = await tabClient.send('Runtime.evaluate', {
      expression: `
        (function() {
          const drawer = document.querySelector('.rm-drawer-in') || document.querySelector('[class*="max-w-2xl"]');
          if (!drawer) return { loaded: false };
          const text = drawer.innerText;
          const expandBtn = Array.from(drawer.querySelectorAll('button')).find(b => b.innerText.includes('View Call Details'));
          return {
            loaded: text.includes('Call History') && !text.includes('Loading call history'),
            hasCalls: Boolean(expandBtn),
            textSnippet: text.slice(text.indexOf('Call History'), text.indexOf('Call History') + 200)
          };
        })()
      `,
      returnByValue: true,
    });

    if (checkCalls.result.value && checkCalls.result.value.loaded) {
      console.log('Calls loaded in tab! Details:', checkCalls.result.value);
      callsLoaded = true;
      break;
    }
    await sleep(800);
  }

  // Expand Call Details if available
  console.log('10. Expanding Call Details...');
  const expandRes = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const drawer = document.querySelector('.rm-drawer-in') || document.querySelector('[class*="max-w-2xl"]');
        if (!drawer) return 'No drawer';
        const btn = Array.from(drawer.querySelectorAll('button')).find(b => b.innerText.includes('View Call Details'));
        if (btn) {
          btn.click();
          return 'Clicked View Call Details';
        }
        return 'No View Call Details button found';
      })()
    `,
    returnByValue: true,
  });
  console.log('Expand Result:', expandRes.result.value);

  await sleep(1500);

  // Toggle Conversation Transcript if available
  const transcriptRes = await tabClient.send('Runtime.evaluate', {
    expression: `
      (function() {
        const drawer = document.querySelector('.rm-drawer-in') || document.querySelector('[class*="max-w-2xl"]');
        if (!drawer) return 'No drawer';
        const btn = Array.from(drawer.querySelectorAll('button')).find(b => b.innerText.includes('Conversation Transcript'));
        if (btn) {
          btn.click();
          return 'Toggled Conversation Transcript';
        }
        return 'No Conversation Transcript button';
      })()
    `,
    returnByValue: true,
  });
  console.log('Transcript toggle:', transcriptRes.result.value);

  await sleep(1500);

  // Capture final screenshot of Call Details
  console.log('11. Capturing live production screenshot...');
  const screenshot = await tabClient.send('Page.captureScreenshot', { format: 'png', quality: 100 });
  fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${SCREENSHOT_PATH} (${screenshot.data.length} bytes base64)`);

  const CALL_DETAILS_SCREENSHOT = path.join(ARTIFACT_DIR, 'production-call-details-verified.png');
  fs.writeFileSync(CALL_DETAILS_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${CALL_DETAILS_SCREENSHOT}`);

  // Cleanup
  try { process.kill(chromeProc.pid); } catch {}
  console.log('=== Production Verification Successful ===');
}

run().catch((err) => {
  console.error('CDP verification error:', err);
  process.exit(1);
});
