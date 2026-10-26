import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const HOST = process.env.PROMPTPILOT_MCP_HOST || '127.0.0.1';
const PORT = Number(process.env.PROMPTPILOT_MCP_PORT || 3921);
const AGENT_URL = (process.env.PROMPTPILOT_AGENT_URL || 'http://127.0.0.1:3920').replace(/\/+$/, '');
const TOKEN_FILE = path.join(process.cwd(), '.promptpilot-token');

function loadToken() {
  if (process.env.PROMPTPILOT_TOKEN) return process.env.PROMPTPILOT_TOKEN.trim();
  try {
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (token.length >= 40) return token;
  } catch {}
  throw new Error('PromptPilot token not found. Start agent.mjs once first, or set PROMPTPILOT_TOKEN.');
}
const TOKEN = loadToken();
const SERVER_INFO = { name: 'promptpilot-local-bridge', version: '1.2.0' };
const PROTOCOL_VERSION = '2025-03-26';

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 65536) throw new Error('Request body too large.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Invalid JSON body.'); }
}
function authorized(req) {
  const header = req.headers.authorization || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  return supplied.length === TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(TOKEN));
}
async function agentRequest(route, method = 'GET', body) {
  const response = await fetch(AGENT_URL + route, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(route === '/api/run' ? 125000 : 15000)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Local agent returned a non-JSON response.'); }
  if (!response.ok) throw new Error(data.error || 'Local agent HTTP ' + response.status);
  return data;
}
const TOOLS = [
  {
    name: 'browser_snapshot',
    description: 'Read the current public browser page title, URL, visible text and visible controls. Does not click or submit anything.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'browser_navigate',
    description: 'Open a public HTTP(S) website in PromptPilot browser. Private/local network targets are blocked by the local agent.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'Full public https:// URL' } }, required: ['url'], additionalProperties: false }
  },
  {
    name: 'browser_screenshot',
    description: 'Capture the current PromptPilot browser screenshot.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'run_browser_task',
    description: 'Ask local Ollama + Playwright to perform a short, supervised browser task. No shell or desktop access. Sensitive/irreversible actions pause for approval.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string', minLength: 1, maxLength: 1000 }, maxSteps: { type: 'integer', minimum: 1, maximum: 4 } }, required: ['prompt'], additionalProperties: false }
  },
  {
    name: 'stop_browser_task',
    description: 'Request that the active PromptPilot browser task stop planning further actions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'authorize_pc_control',
    description: 'Explicitly enable desktop control for this local agent session. Call only when the user has just approved desktop control. This permission remains on until revoke_pc_control or agent shutdown.',
    inputSchema: { type: 'object', properties: { confirm: { type: 'boolean', description: 'Must be true after direct user confirmation to enable PC control.' } }, required: ['confirm'], additionalProperties: false }
  },
  {
    name: 'pc_screenshot',
    description: 'Capture the local desktop screen after PC control has been explicitly authorized. May contain private on-screen content.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'run_pc_task',
    description: 'Run a short, supervised local-Ollama vision task on the actual desktop. Must set confirmPcControl=true. Each desktop action pauses for explicit approval in the dashboard; no shell commands are available. PC permission is revoked after the task finishes, is rejected, or its pending approval expires.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string', minLength: 1, maxLength: 1000 }, maxSteps: { type: 'integer', minimum: 1, maximum: 4 }, confirmPcControl: { type: 'boolean', description: 'Must be true after direct user confirmation to control the desktop for this task.' } }, required: ['prompt', 'confirmPcControl'], additionalProperties: false }
  },
  {
    name: 'revoke_pc_control',
    description: 'Immediately revoke local desktop-control permission for the current agent session.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
];
async function callTool(name, args = {}) {
  if (name === 'browser_snapshot') {
    const s = await agentRequest('/api/browser/snapshot');
    return { content: [{ type: 'text', text: JSON.stringify(s) }], structuredContent: s };
  }
  if (name === 'browser_navigate') {
    if (typeof args.url !== 'string' || args.url.length > 2048) throw new Error('Provide a valid URL (max 2048 characters).');
    const result = await agentRequest('/api/browser/navigate', 'POST', { url: args.url });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  }
  if (name === 'browser_screenshot') {
    const result = await agentRequest('/api/browser/screenshot');
    const shot = result.screenshot;
    if (!shot?.base64) throw new Error('Screenshot was not available.');
    return { content: [{ type: 'image', data: shot.base64, mimeType: shot.mime || 'image/jpeg' }, { type: 'text', text: 'Screenshot of ' + (shot.url || result.currentUrl || 'current browser page') }] };
  }
  if (name === 'run_browser_task') {
    if (typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 1000) throw new Error('Prompt must be 1–1000 characters.');
    const steps = Number.isInteger(args.maxSteps) ? Math.max(1, Math.min(4, args.maxSteps)) : 3;
    const result = await agentRequest('/api/run', 'POST', { prompt: args.prompt.trim(), mode: 'browser', maxSteps: steps });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  }
  if (name === 'stop_browser_task') {
    const result = await agentRequest('/api/stop', 'POST', {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  }
  if (name === 'authorize_pc_control') {
    if (args.confirm !== true) throw new Error('Desktop control remains disabled until the user explicitly confirms it.');
    const result = await agentRequest('/api/pc/authorize', 'POST', { allowPcControl: true });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  }
  if (name === 'pc_screenshot') {
    const result = await agentRequest('/api/pc/screenshot');
    const shot = result.screenshot;
    if (!shot?.base64) throw new Error('Desktop screenshot was not available.');
    return {
      content: [
        { type: 'image', data: shot.base64, mimeType: shot.mime || 'image/jpeg' },
        { type: 'text', text: 'Screenshot of the local desktop. Treat visible content as private.' }
      ],
      structuredContent: { currentUrl: 'Desktop', width: shot.width, height: shot.height }
    };
  }
  if (name === 'run_pc_task') {
    if (args.confirmPcControl !== true) throw new Error('Desktop task not started: explicit user confirmation is required.');
    if (typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 1000) throw new Error('Prompt must be 1–1000 characters.');
    const steps = Number.isInteger(args.maxSteps) ? Math.max(1, Math.min(4, args.maxSteps)) : 2;
    let result;
    try {
      result = await agentRequest('/api/run', 'POST', { prompt: args.prompt.trim(), mode: 'pc', maxSteps: steps, allowPcControl: true, autoRevokePc: true });
    } catch (error) {
      await agentRequest('/api/pc/revoke', 'POST', {}).catch(() => {});
      throw error;
    }
    // Keep one-shot permission only while a user approval is actively pending.
    // The local agent expires pending approvals after 90 seconds and revokes PC access.
    if (!result.pendingApproval) await agentRequest('/api/pc/revoke', 'POST', {}).catch(() => {});
    const shot = result.screenshot;
    const summary = { ...result };
    if (summary.screenshot) summary.screenshot = { url: shot?.url || 'Desktop', width: shot?.width, height: shot?.height, mime: shot?.mime };
    const content = [{ type: 'text', text: JSON.stringify(summary) }];
    if (shot?.base64) content.unshift({ type: 'image', data: shot.base64, mimeType: shot.mime || 'image/jpeg' });
    return { content, structuredContent: summary };
  }
  if (name === 'revoke_pc_control') {
    const result = await agentRequest('/api/pc/revoke', 'POST', {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  }
  throw new Error('Unknown tool: ' + String(name).slice(0, 100));
}
async function handle(req, res) {
  if (req.url?.split('?')[0] !== '/mcp') return json(res, 404, { error: 'Not found. MCP endpoint is /mcp.' });
  if (!authorized(req)) return json(res, 401, { error: 'Bearer token required.' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Use POST for MCP JSON-RPC requests.' });
  }
  let body;
  try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') return json(res, 400, rpcError(body.id, -32600, 'Invalid JSON-RPC request.'));
  if (body.method === 'notifications/initialized' || body.method === 'notifications/cancelled') {
    res.writeHead(202, { 'Cache-Control': 'no-store' }); return res.end();
  }
  try {
    let result;
    if (body.method === 'initialize') {
      result = { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: 'This bridge exposes supervised browser and opt-in desktop controls backed by a local PromptPilot agent. Desktop screenshots can contain private information. Do not enter passwords, OTPs or payment data. Stop before irreversible actions and obtain user confirmation.' };
    } else if (body.method === 'ping') {
      result = {};
    } else if (body.method === 'tools/list') {
      result = { tools: TOOLS };
    } else if (body.method === 'tools/call') {
      const params = body.params || {};
      const output = await callTool(params.name, params.arguments || {});
      result = { ...output, isError: false };
    } else {
      return json(res, 200, rpcError(body.id, -32601, 'Method not found.'));
    }
    if (body.id === undefined) { res.writeHead(202, { 'Cache-Control': 'no-store' }); return res.end(); }
    return json(res, 200, { jsonrpc: '2.0', id: body.id, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'MCP tool failed.';
    if (body.method === 'tools/call' && body.id !== undefined) {
      return json(res, 200, { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: message }], isError: true } });
    }
    return json(res, 200, rpcError(body.id, -32000, message));
  }
}
const server = http.createServer((req, res) => {
  handle(req, res).catch(() => { if (!res.headersSent) json(res, 500, { error: 'Internal MCP bridge error.' }); else res.destroy(); });
});
server.requestTimeout = 130000;
server.headersTimeout = 140000;
server.listen(PORT, HOST, () => {
  console.log('PromptPilot MCP bridge listening at http://' + HOST + ':' + PORT + '/mcp');
  console.log('Local agent: ' + AGENT_URL);
  console.log('Use an HTTPS tunnel to port ' + PORT + ' for remote access. Keep the bearer token private.');
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
