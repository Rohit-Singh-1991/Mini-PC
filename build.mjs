import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const publicAgent = path.join(dist, 'agent');

await rm(dist, { recursive: true, force: true });
await mkdir(publicAgent, { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await copyFile(path.join(root, 'code-signing.html'), path.join(dist, 'code-signing.html'));
await copyFile(path.join(root, 'app.js'), path.join(dist, 'app.js'));
await copyFile(path.join(root, 'agent-connection-policy.mjs'), path.join(dist, 'agent-connection-policy.mjs'));

const downloadableFiles = [
  'README.md',
  'agent.mjs',
  'mcp-bridge.mjs',
  'security.mjs',
  'approval-policy.mjs',
  'package.json',
  'install.ps1',
  'smoke-test.mjs',
];
const agentSource = path.join(root, 'agent');
for (const file of downloadableFiles) {
  await copyFile(path.join(agentSource, file), path.join(publicAgent, file));
}

console.log(`PromptPilot static dashboard built to ${dist}`);
