import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchId, timeLink } from '../src/watch.ts';

const id = 'abcdefghijk';
const youtube = 'https://www.youtube.com';

test('only canonical top-level Watch URLs with one valid ID qualify', () => {
  assert.equal(watchId(new URL(youtube + '/watch?v=' + id + '&list=example')), id);
  for (const url of [
    youtube + '/watch',
    youtube + '/watch?v=' + id + '&v=' + id,
    youtube + '/results?v=' + id,
    'https://youtube.com/watch?v=' + id,
    'https://www.youtube.com.example/watch?v=' + id,
    youtube + '/watch?v=%3Cscript%3E',
  ]) assert.equal(watchId(new URL(url)), null, url);
});

test('timestamp links contain only the video and whole seconds', () => {
  assert.equal(timeLink(id, 127.9), youtube + '/watch?v=' + id + '&t=127s');
  for (const seconds of [-1, NaN, Infinity]) assert.throws(() => timeLink(id, seconds), RangeError);
  assert.throws(() => timeLink('x&list=bad', 5), RangeError);
});
