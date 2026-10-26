import assert from 'node:assert/strict';
import { isPrivateAddress, safeUrl, safeWebSocketUrl, redactUrlForDisplay } from './security.mjs';
import { actionNeedsApproval } from './approval-policy.mjs';
import { allowedAgentOrigin } from '../agent-connection-policy.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const blockedAddresses = [
  '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254',
  '172.16.0.1', '172.31.255.254', '192.168.1.10', '198.18.0.1',
  '198.51.100.7', '203.0.113.9', '224.0.0.1', '::', '::1',
  'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '2001:db8::1',
  '2002:0a00:0001::1', '::ffff:172.16.0.1', '::ffff:169.254.169.254',
  '64:ff9b::a9fe:a9fe'
];
for (const ip of blockedAddresses) {
  assert.equal(isPrivateAddress(ip), true, 'must block non-public address ' + ip);
}
for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) {
  assert.equal(isPrivateAddress(ip), false, 'must allow public address ' + ip);
}
await assert.rejects(() => safeUrl('https://user:pass@example.com'), /embedded usernames or passwords/);
const displayedUrl = new URL(redactUrlForDisplay('https://example.com/callback?access_token=secret-value&state=csrf-state&view=grid'));
assert.equal(displayedUrl.searchParams.get('access_token'), '[redacted]', 'access tokens must not appear in UI URLs');
assert.equal(displayedUrl.searchParams.get('state'), '[redacted]', 'OAuth state values must not appear in UI URLs');
assert.equal(displayedUrl.searchParams.get('view'), 'grid', 'ordinary query parameters should remain readable');

await assert.rejects(() => safeUrl('http://[::ffff:172.16.0.1]/'), /Private or reserved IP blocked/);
await assert.rejects(() => safeWebSocketUrl('ws://[::ffff:172.16.0.1]/'), /Private or reserved IP blocked/);
await assert.rejects(() => safeWebSocketUrl('wss://user:pass@example.com'), /embedded usernames or passwords/);
assert.equal(actionNeedsApproval({
  action: { tool: 'click', target: 'Save changes' }, mode: 'browser',
  clickInfo: { tag: 'a', href: 'https://example.com/save', text: 'Save changes', formAssociated: false, submitType: false, disabled: false }
}), true, 'risky link must pause for approval');
assert.equal(actionNeedsApproval({
  action: { tool: 'navigate', url: 'https://example.com/unsubscribe?id=123' }, mode: 'browser'
}), true, 'potentially state-changing GET navigations must pause');
assert.equal(actionNeedsApproval({
  action: { tool: 'fill', target: 'Email', value: 'person@example.com' }, mode: 'browser'
}), true, 'form data entry must pause for destination/value review');
assert.equal(actionNeedsApproval({
  action: { tool: 'click', target: 'Open article' }, mode: 'browser',
  clickInfo: { tag: 'a', href: 'https://example.com/article', text: 'Open article', formAssociated: false, submitType: false, disabled: false }
}), false, 'ordinary public navigation link can proceed');
assert.equal(actionNeedsApproval({
  action: { tool: 'click', target: 'Continue' }, mode: 'browser',
  clickInfo: { tag: 'button', text: 'Continue', formAssociated: true, submitType: true, disabled: false }
}), true, 'button/form actions must pause for approval');
assert.equal(actionNeedsApproval({ action: { tool: 'pc_click' }, mode: 'pc' }), true, 'desktop actions must pause for approval');

const allowedConnectCases=[
  ['https://random-word.trycloudflare.com',true],
  ['http://localhost:3920',true],
  ['http://127.0.0.1:3920',true],
  ['https://evil.example.com',false],
  ['https://trycloudflare.com',false],
  ['https://user:secret@random-word.trycloudflare.com',false],
  ['https://random-word.trycloudflare.com/agent',false],
  ['https://random-word.trycloudflare.com/?token=secret',false]
];
for(const [url,expected] of allowedConnectCases) {
  assert.equal(Boolean(allowedAgentOrigin(url)),expected,'agent connection policy for '+url);
}

console.log('PASS IP classification: private, special-use, mapped IPv4 and public IPv6 cases');
console.log('PASS dashboard bearer-token target allowlist');
console.log('PASS unsafe URL credential rejection');
console.log('PASS conservative browser/desktop action approval policy');

const agentDirectory=path.dirname(fileURLToPath(import.meta.url));
const host='127.0.0.1';
const ollamaPort=14351;
const agentPort=13921;
const token='promptpilot-smoke-test-token-0123456789-abcdefghijklmnopqrstuvwxyz';
let chatCalls=0,tagsStatus=200;
const mockOllama=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'&&req.url==='/api/tags'){
    if(tagsStatus!==200){res.writeHead(tagsStatus);res.end(JSON.stringify({error:'mock Ollama endpoint error'}));return;}
    res.end(JSON.stringify({models:[{name:'mock:latest'}]})); return;
  }
  if(req.method==='POST'&&req.url==='/api/chat'){
    let raw='';for await(const c of req)raw+=c;
    const body=JSON.parse(raw);
    const input=JSON.parse(body.messages?.[1]?.content||'{}');
    chatCalls++;
    const action=input.step===1
      ? {tool:'navigate',summary:'Open public smoke-test page',url:'https://example.com'}
      : {tool:'done',summary:'Smoke test completed after inspecting the page'};
    res.end(JSON.stringify({message:{role:'assistant',content:JSON.stringify(action)},done:true})); return;
  }
  res.writeHead(404);res.end(JSON.stringify({error:'not found'}));
});
let agent,bridge,logs='',bridgeLogs='';
try{
  await new Promise((resolve,reject)=>{mockOllama.once('error',reject);mockOllama.listen(ollamaPort,host,resolve)});
  agent=spawn(process.execPath,['agent.mjs'],{
    cwd:agentDirectory,
    env:{...process.env,PORT:String(agentPort),OLLAMA_URL:`http://${host}:${ollamaPort}`,OLLAMA_MODEL:'mock:latest',OLLAMA_VISION_MODEL:'mock-vision:latest',PROMPTPILOT_TOKEN:token,PROMPTPILOT_ALLOWED_ORIGINS:'http://localhost:5173'},
    stdio:['ignore','pipe','pipe']
  });
  agent.stdout.on('data',d=>logs+=d);agent.stderr.on('data',d=>logs+=d);
  const base=`http://${host}:${agentPort}`;
  async function request(path,body,withAuth=true){
    const headers={'Content-Type':'application/json','Origin':'http://localhost:5173'};
    if(withAuth)headers.Authorization=`Bearer ${token}`;
    return fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  }
  let health;
  for(let i=0;i<80;i++){
    try{health=await request('/health');if(health.status===200)break}catch{}
    await delay(250);
  }
  assert.equal(health?.status,200,'agent health endpoint should respond with a valid token');
  const healthJson=await health.json();
  assert.equal(healthJson.ollama,true,'agent should reach mock local Ollama');
  assert.equal(healthJson.modelLoaded,true,'agent should detect the local model');
  const unauthorized=await request('/health',undefined,false);
  assert.equal(unauthorized.status,401,'agent must reject requests without bearer token');
  const blocked=await request('/api/browser/navigate',{url:`http://127.0.0.1:${agentPort}/health`});
  assert.equal(blocked.status,400,'agent must reject loopback/private network navigation');
  const run=await request('/api/run',{prompt:'Open https://example.com and inspect the page',mode:'browser',maxSteps:3});
  const result=await run.json();
  assert.equal(run.status,200,JSON.stringify(result).slice(0,500));
  assert.equal(result.currentUrl,'https://example.com/','Playwright should navigate to the public test page');
  const pageCheck=await request('/api/browser/snapshot');
  assert.equal(pageCheck.status,200,'snapshot endpoint should return a page snapshot');
  const pageJson=await pageCheck.json();
  assert.match(pageJson.title,/Example Domain/,'browser title should be verified, not just the URL');
  assert.ok(typeof pageJson.body==='string'&&pageJson.body.trim().length>20,'visible page text should be non-empty');
  assert.ok(Array.isArray(result.steps)&&result.steps.length>=1,'run should return executed step logs');
  assert.ok(result.screenshot?.base64,'run should return a browser screenshot');
  assert.ok(chatCalls>=2,'agent should call local Ollama for planning');
  tagsStatus=404;
  const brokenHealth=await request('/health');
  const brokenJson=await brokenHealth.json();
  assert.equal(brokenJson.ollamaHttpStatus,404,'health endpoint should expose an Ollama HTTP error');
  assert.match(brokenJson.ollamaError,/HTTP 404/,'health endpoint should explain the 404 and base URL');
  tagsStatus=200;
  console.log('PASS health + Ollama model discovery');
  console.log('PASS Ollama HTTP 404 diagnostics');
  console.log('PASS bearer-token authentication');
  console.log('PASS private/loopback URL blocking');
  console.log('PASS mocked-local-Ollama -> Playwright navigation -> screenshot');
  console.log('PASS browser title + visible text verification');

  bridge=spawn(process.execPath,['mcp-bridge.mjs'],{
    cwd:agentDirectory,
    env:{...process.env,PROMPTPILOT_MCP_HOST:host,PROMPTPILOT_MCP_PORT:'13922',PROMPTPILOT_AGENT_URL:base,PROMPTPILOT_TOKEN:token},
    stdio:['ignore','pipe','pipe']
  });
  bridge.stdout.on('data',d=>bridgeLogs+=d);bridge.stderr.on('data',d=>bridgeLogs+=d);
  const mcpBase=`http://${host}:13922/mcp`;
  async function mcpRequest(payload,withAuth=true){
    const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
    if(withAuth)headers.Authorization=`Bearer ${token}`;
    return fetch(mcpBase,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  }
  let mcpInit;
  for(let i=0;i<80;i++){
    try{mcpInit=await mcpRequest({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'smoke-test',version:'1.0'}}});if(mcpInit.status===200)break}catch{}
    await delay(250);
  }
  assert.equal(mcpInit?.status,200,'MCP bridge should initialize');
  const initJson=await mcpInit.json();
  assert.equal(initJson.result?.serverInfo?.name,'promptpilot-local-bridge','MCP server info should be returned');
  const unauthMcp=await mcpRequest({jsonrpc:'2.0',id:2,method:'tools/list'},false);
  assert.equal(unauthMcp.status,401,'MCP bridge must reject requests without bearer token');
  const listed=await mcpRequest({jsonrpc:'2.0',id:3,method:'tools/list'});
  const listJson=await listed.json();
  assert.equal(listJson.result?.tools?.length,9,'MCP bridge should expose the five browser tools plus four explicitly gated PC tools');
  const snap=await mcpRequest({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'browser_snapshot',arguments:{}}});
  const snapJson=await snap.json();
  assert.equal(snapJson.result?.isError,false,'MCP browser snapshot tool should call the local agent');
  assert.match(snapJson.result?.structuredContent?.title||'',/Example Domain/,'MCP snapshot should read current page title');
  const deniedPc = await mcpRequest({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'run_pc_task',arguments:{prompt:'Click the desktop',confirmPcControl:false}}});
  const deniedPcJson = await deniedPc.json();
  assert.equal(deniedPcJson.result?.isError,true,'PC task must reject calls without explicit confirmation');
  const authorizePc = await mcpRequest({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'authorize_pc_control',arguments:{confirm:true}}});
  const authorizePcJson = await authorizePc.json();
  assert.equal(authorizePcJson.result?.isError,false,'explicit PC authorization should be accepted');
  const pcEnabled = await (await request('/health')).json();
  assert.equal(pcEnabled.desktopPermission,true,'PC authorization should enable desktop permission');
  const revokePc = await mcpRequest({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'revoke_pc_control',arguments:{}}});
  const revokePcJson = await revokePc.json();
  assert.equal(revokePcJson.result?.isError,false,'PC revoke should succeed');
  const pcDisabled = await (await request('/health')).json();
  assert.equal(pcDisabled.desktopPermission,false,'PC revoke should disable desktop permission');
  console.log('PASS MCP initialize + nine-tool discovery + authenticated browser snapshot');
  console.log('PASS explicit desktop authorization, denied task without consent, and revoke');
}catch(err){
  console.error('PromptPilot smoke test failed:',err);
  if(agent)console.error('Agent output:',logs);
  if(bridge)console.error('MCP bridge output:',bridgeLogs);
  process.exitCode=1;
}finally{
  if(bridge){bridge.kill('SIGINT');await Promise.race([new Promise(resolve=>bridge.once('exit',resolve)),delay(3000)])}
  if(agent){agent.kill('SIGINT');await Promise.race([new Promise(resolve=>agent.once('exit',resolve)),delay(5000)])}
  await new Promise(resolve=>mockOllama.close(()=>resolve()));
}
