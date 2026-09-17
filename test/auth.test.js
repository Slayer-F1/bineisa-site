import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/auth.js', import.meta.url), 'utf8');

function formHarness(channel = 'email', accepted = true) {
  const handlers = {};
  const input = {
    value: '', focus() {}, select() {}, setAttribute() {},
    addEventListener(name, fn) { handlers[name] = fn; },
  };
  const message = { setAttribute() {}, removeAttribute() {} };
  const form = {
    classList: { remove() {}, add() {} },
    addEventListener(name, fn) { handlers[name] = fn; },
  };
  const elements = { 'f-code': input, codeForm: form, authMsg: message };
  const calls = [];
  const location = { search: '', hash: '', pathname: '/auth/login.html', href: '' };
  const pending = { channel, email: 'test@example.invalid', phone: '+971500000000', ts: Date.now() };
  const sbClient = { auth: {
    onAuthStateChange() {},
    getSession: async () => ({ data: {} }),
    verifyOtp: async params => {
      calls.push(params);
      return accepted ? { data: { session: {} } } : { error: { code: 'otp_expired' } };
    },
  } };
  vm.runInNewContext(source, {
    window: { BINEISA_CONFIG: { authChannel: channel }, sbClient, location,
      t: key => key, guardClick: (_, fn) => fn },
    document: { getElementById: id => elements[id] || null, querySelectorAll: () => [] },
    sessionStorage: { getItem: () => JSON.stringify(pending), removeItem() {} },
    location, URLSearchParams, setTimeout: fn => fn(), clearInterval() {},
  });
  return { input, message, calls, location, handlers };
}

test('email OTP preserves all eight digits, including Arabic numerals, before verification', async () => {
  const h = formHarness();
  h.input.value = '١٢٣٤٥٦٧٨';
  h.handlers.input();
  assert.equal(h.input.value, '12345678');
  await h.handlers.submit({ preventDefault() {} });
  assert.equal(h.calls[0].token, '12345678');
  assert.equal(h.calls[0].type, 'email');
  assert.equal(h.location.href, '/account/');
});

test('six-digit SMS remains supported and incomplete codes do not reach the provider', async () => {
  const h = formHarness('phone');
  h.input.value = '12345';
  await h.handlers.submit({ preventDefault() {} });
  assert.equal(h.calls.length, 0);
  assert.equal(h.message.textContent, 'errCode');
  h.input.value = '123456';
  await h.handlers.submit({ preventDefault() {} });
  assert.equal(h.calls[0].type, 'sms');
  assert.equal(h.calls[0].token, '123456');
});

test('provider-rejected codes never advance to the account', async () => {
  const h = formHarness('email', false);
  h.input.value = '12345678';
  await h.handlers.submit({ preventDefault() {} });
  assert.equal(h.location.href, '');
  assert.equal(h.message.textContent, 'errCodeInvalid');
});

test('both auth pages permit an eight-digit code in native browser validation', () => {
  for (const page of ['login', 'register']) {
    const html = readFileSync(new URL(`../auth/${page}.html`, import.meta.url), 'utf8');
    const input = html.match(/<input id="f-code"[^>]+>/)[0];
    const pattern = input.match(/pattern="([^"]+)"/)[1];
    const maxLength = Number(input.match(/maxlength="(\d+)"/)[1]);
    assert.ok(new RegExp(`^(?:${pattern})$`).test('12345678'));
    assert.ok(maxLength >= 8);
  }
});
