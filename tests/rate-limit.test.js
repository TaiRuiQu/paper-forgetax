import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, createAuthRateLimiter } from '../server/src/rate-limit.js';

test('auth limit uses a rolling five-minute window and rejected requests do not extend it', () => {
  let now = 0;
  const limit = createAuthRateLimiter(() => now);
  assert.equal(limit('a'), 0);
  now = 1000;
  for (let i = 0; i < 9; i++) assert.equal(limit('a'), 0);
  assert.equal(limit('a'), 299);
  assert.equal(limit('b'), 0);
  now = 299_999;
  assert.equal(limit('a'), 1);
  now = 300_000;
  assert.equal(limit('a'), 0);
  assert.equal(limit('a'), 1);
  now = 301_000;
  for (let i = 0; i < 9; i++) assert.equal(limit('a'), 0);
  assert.equal(limit('a'), 299);
  now = 601_000;
  for (let i = 0; i < 10; i++) assert.equal(limit('a'), 0);
  assert.equal(limit('a'), 300);
});

test('client IP prefers CF-Connecting-IP and normalizes IPv6', () => {
  const req = header => ({ headers: { 'cf-connecting-ip': header }, socket: { remoteAddress: '127.0.0.1' } });
  assert.equal(clientIp(req(' 203.0.113.7 ')), '203.0.113.7');
  for (const header of [undefined, '', 'invalid', '203.0.113.7, 203.0.113.8']) {
    assert.equal(clientIp(req(header)), '127.0.0.1');
  }
  assert.equal(clientIp(req('2001:0DB8:0:0:0:0:0:1')), clientIp(req('2001:db8::1')));
});

test('client IP falls back to the first X-Forwarded-For address, then the connection IP', () => {
  const req = (cf, xff) => ({
    headers: { 'cf-connecting-ip': cf, 'x-forwarded-for': xff },
    socket: { remoteAddress: '127.0.0.1' },
  });
  assert.equal(clientIp(req('203.0.113.7', '203.0.113.8')), '203.0.113.7');
  for (const cf of [undefined, '', 'invalid']) {
    assert.equal(clientIp(req(cf, ' 203.0.113.8, 10.0.0.1 ')), '203.0.113.8');
  }
  assert.equal(clientIp(req(undefined, '203.0.113.8')), '203.0.113.8');
  assert.equal(clientIp(req(undefined, '2001:0DB8:0:0:0:0:0:1, 10.0.0.1')),
    clientIp(req('2001:db8::1')));
  for (const xff of [undefined, '', 'invalid', 'invalid, 203.0.113.8']) {
    assert.equal(clientIp(req(undefined, xff)), '127.0.0.1');
  }
});
