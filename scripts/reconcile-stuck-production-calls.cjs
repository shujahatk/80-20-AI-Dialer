const https = require('https');
const fs = require('fs');

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RETELL_KEY = env.RETELL_API_KEY;

function supaPatch(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + path);
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }, res => {
      let respData = '';
      res.on('data', d => respData += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(respData) }); }
        catch (e) { resolve({ status: res.statusCode, body: respData }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function supaGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + path);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function retellGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.retellai.com' + path);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + RETELL_KEY,
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function reconcileStuckCalls() {
  console.log('=== Checking for stuck calls with ended_at populated and non-terminal status ===');
  const stuckCalls = await supaGet('call_sessions?status=in.(queued,registered,ringing,in_progress)&ended_at=not.is.null');
  console.log(`Found ${stuckCalls.length} stuck call(s):`);

  for (const call of stuckCalls) {
    console.log(`\nReconciling Call ID: ${call.id} (Lead: ${call.lead_id}, Status: ${call.status})`);
    let terminalStatus = 'no_answer';

    if (call.retell_call_id) {
      console.log(`Querying Retell for ${call.retell_call_id}...`);
      const retellRes = await retellGet('/v2/get-call/' + call.retell_call_id);
      if (retellRes.status === 200) {
        const rc = retellRes.body;
        console.log(`Retell status: ${rc.call_status}, reason: ${rc.disconnection_reason}`);
        if (rc.disconnection_reason === 'dial_no_answer' || rc.disconnection_reason === 'no_answer') {
          terminalStatus = 'no_answer';
        } else if (rc.disconnection_reason === 'dial_busy' || rc.disconnection_reason === 'busy') {
          terminalStatus = 'busy';
        } else if (rc.disconnection_reason === 'dial_failed' || rc.disconnection_reason === 'failed') {
          terminalStatus = 'failed';
        } else {
          terminalStatus = 'completed';
        }
      } else if (retellRes.status === 404) {
        terminalStatus = 'failed';
      }
    } else if (call.disconnection_reason) {
      if (call.disconnection_reason.includes('no_answer')) terminalStatus = 'no_answer';
      else if (call.disconnection_reason.includes('busy')) terminalStatus = 'busy';
      else if (call.disconnection_reason.includes('failed')) terminalStatus = 'failed';
      else terminalStatus = 'completed';
    }

    console.log(`Updating ${call.id} to status = '${terminalStatus}'...`);
    const updateRes = await supaPatch(`call_sessions?id=eq.${call.id}`, {
      status: terminalStatus,
      disconnection_reason: call.disconnection_reason || 'dial_no_answer'
    });
    console.log(`Update response status: ${updateRes.status}`);
  }

  console.log('\n=== Verification after reconciliation ===');
  const remaining = await supaGet('call_sessions?status=in.(queued,registered,ringing,in_progress)&ended_at=not.is.null');
  console.log(`Remaining stuck calls: ${remaining.length}`);

  const activeCheck = await supaGet('call_sessions?status=in.(queued,ringing,in_progress)');
  console.log(`Total remaining active calls across entire DB: ${activeCheck.length}`);
}

reconcileStuckCalls().catch(console.error);
