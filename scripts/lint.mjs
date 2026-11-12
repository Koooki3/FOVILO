import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('public/manifest.json', 'utf8'));
assert.deepEqual(Object.keys(manifest).sort(), [
  'action', 'background', 'commands', 'content_scripts', 'default_locale', 'description', 'manifest_version',
  'minimum_chrome_version', 'name', 'permissions', 'version',
]);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.background, { service_worker: 'background.js' });
assert.equal(manifest.default_locale, 'en');
assert.equal(manifest.description, '__MSG_extensionDescription__');
assert.deepEqual(manifest.commands, { 'open-commands': { description: '__MSG_shortcutDescription__' } });
const en = JSON.parse(await readFile('public/_locales/en/messages.json', 'utf8'));
const zh = JSON.parse(await readFile('public/_locales/zh_CN/messages.json', 'utf8'));
assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
for (const key of Object.keys(en)) {
  assert.ok(en[key].message.trim() && zh[key].message.trim(), key);
  assert.deepEqual(zh[key].message.match(/\$\d/g), en[key].message.match(/\$\d/g), key);
}
assert.deepEqual(manifest.content_scripts, [{
  matches: ['https://www.youtube.com/*'],
  js: ['content.js'],
  run_at: 'document_idle',
  world: 'ISOLATED',
  all_frames: false,
}]);
console.log('MV3 manifest policy checks passed.');
