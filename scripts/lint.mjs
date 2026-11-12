import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('public/manifest.json', 'utf8'));
assert.deepEqual(Object.keys(manifest).sort(), [
  'action', 'background', 'commands', 'content_scripts', 'description', 'manifest_version',
  'minimum_chrome_version', 'name', 'permissions', 'version',
]);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.background, { service_worker: 'background.js' });
assert.deepEqual(manifest.commands, { 'open-commands': { description: 'Open FOVILO Commands' } });
assert.deepEqual(manifest.content_scripts, [{
  matches: ['https://www.youtube.com/*'],
  js: ['content.js'],
  run_at: 'document_idle',
  world: 'ISOLATED',
  all_frames: false,
}]);
console.log('MV3 manifest policy checks passed.');
