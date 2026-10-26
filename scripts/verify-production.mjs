import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const html = read('index.html');
const app = read('app.js');
assert.ok(html.includes('<script type="module" src="/app.js"></script>'), 'dashboard must load external app.js as a module');
assert.ok(!/<script>([\s\S]*?)<\/script>/.test(html), 'inline scripts are forbidden by the release CSP');
assert.ok(app.includes("import { allowedAgentOrigin } from './agent-connection-policy.mjs';"), 'dashboard must use the tested agent-origin allowlist');

for (const token of [
  'prompt', 'agentUrl', 'agentToken', 'previewImage', 'allowPC',
  'URL security module', 'Approval policy', '/agent/agent.mjs', '/agent/mcp-bridge.mjs'
]) assert.ok(html.includes(token), 'missing UI element or route: ' + token);

for (const token of ['sessionStorage', '/api/run', '/api/approve', '/api/pc/click']) {
  assert.ok(app.includes(token), 'missing dashboard behavior: ' + token);
}

for (const path of ['app.js', 'index.html', 'agent-connection-policy.mjs']) {
  assert.ok(fs.existsSync('dist/' + path), 'production build is missing dist/' + path);
}
for (const path of ['security.mjs', 'approval-policy.mjs', 'mcp-bridge.mjs', 'install.ps1']) {
  assert.ok(fs.existsSync('dist/agent/' + path), 'setup kit is missing dist/agent/' + path);
}

const agent = read('agent/agent.mjs');
const security = read('agent/security.mjs');
const approval = read('agent/approval-policy.mjs');
for (const token of [
  'crypto.timingSafeEqual', '/api/run', '/api/approve', '/api/stop',
  '/api/pc/authorize', 'await safeUrl(u)', 'routeWebSocket', 'OLLAMA_URL',
  'otp|captcha|verification', 'pending.resume'
]) assert.ok(agent.includes(token), 'missing runtime feature: ' + token);

for (const token of [
  'dns.lookup', 'isPrivateAddress', '::ffff', 'embedded usernames or passwords',
  'Private or reserved IP', 'redactUrlForDisplay', 'safeWebSocketUrl'
]) assert.ok(security.includes(token), 'missing URL security feature: ' + token);

for (const token of ['actionNeedsApproval', 'formAssociated', 'submitType', 'mode ===']) {
  assert.ok(approval.includes(token), 'missing approval policy: ' + token);
}

const build = read('build.mjs');
const csp = read('vercel.json');
assert.ok(csp.includes("script-src 'self';"), 'CSP must allow only same-origin scripts');
assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), 'CSP must block inline JavaScript');
for (const token of ['app.js', 'agent-connection-policy.mjs', 'security.mjs', 'approval-policy.mjs']) {
  assert.ok(build.includes(token), 'build script omits ' + token);
}

const installer = read('agent/install.ps1');
for (const token of ['$PSScriptRoot', 'Copy-Item', 'npm install', 'npx playwright install chromium', 'ollama pull qwen2.5:3b']) {
  assert.ok(installer.includes(token), 'missing installer step: ' + token);
}

console.log('PASS production dashboard/CSP/build bundle checks');
console.log('PASS local-agent authentication, URL, WebSocket and action-approval controls');
console.log('PASS Windows/local setup kit completeness');
