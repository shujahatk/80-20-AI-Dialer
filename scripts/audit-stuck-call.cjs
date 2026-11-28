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

async function audit() {
  console.log('=== 1. QUERY SPECIFIC CALL: 34cceea3-0232-4a4e-9433-26786d1e1d7b ===');
  const call = await supaGet('call_sessions?id=eq.34cceea3-0232-4a4e-9433-26786d1e1d7b');
  console.log('Session row:', JSON.stringify(call, null, 2));

  if (call && call.length > 0) {
    const c = call[0];
    console.log('Retell call ID in DB:', c.retell_call_id);
    if (c.retell_call_id) {
      console.log('=== Checking Retell for retell_call_id ===');
      const retellRes = await retellGet('/v2/get-call/' + c.retell_call_id);
      console.log('Retell Response status:', retellRes.status);
      console.log('Retell Response body:', JSON.stringify(retellRes.body, null, 2));
    }
  }

  console.log('\n=== 2. AUDIT LOGS & OUTCOMES FOR THIS CALL ===');
  const outcomes = await supaGet('call_outcomes?call_session_id=eq.34cceea3-0232-4a4e-9433-26786d1e1d7b');
  console.log('Outcomes for 34cceea3:', JSON.stringify(outcomes, null, 2));

  console.log('\n=== 3. ALL CALL SESSIONS FOR SHUJAHAT KHAN (lead_id: 5e36899f-75cf-4cbf-ba55-6881be52e089) ===');
  const allCalls = await supaGet('call_sessions?lead_id=eq.5e36899f-75cf-4cbf-ba55-6881be52e089&order=created_at.desc&limit=10');
  console.log('Lead Call Sessions count:', allCalls ? allCalls.length : 0);
  if (allCalls && Array.isArray(allCalls)) {
    allCalls.forEach(cs => {
      console.log(`- ID: ${cs.id} | Status: ${cs.status} | RetellID: ${cs.retell_call_id} | Created: ${cs.created_at} | Duration: ${cs.duration_seconds} | Failure: ${cs.failure_reason}`);
    });
  }

  console.log('\n=== 4. ANY OTHER CALLS IN QUEUED, INITIATED, OR IN-PROGRESS STATUS IN DB ===');
  const activeCalls = await supaGet('call_sessions?status=in.(queued,initiated,ringing,in_progress,pending)&order=created_at.desc&limit=10');
  console.log('Active/Queued calls in DB:', JSON.stringify(activeCalls, null, 2));

  console.log('\n=== 5. CALLS WITH NON-TERMINAL STATUS BUT ENDED_AT POPULATED ===');
  const endedStuck = await supaGet('call_sessions?status=in.(queued,registered,ringing,in_progress)&ended_at=not.is.null&order=created_at.desc');
  console.log('Stuck calls with ended_at populated:', JSON.stringify(endedStuck, null, 2));
}

audit().catch(console.error);
