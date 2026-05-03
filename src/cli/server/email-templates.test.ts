import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWaitlistConfirmation } from './email-templates.js';

test('renderWaitlistConfirmation includes position, email, brand assets', () => {
  const out = renderWaitlistConfirmation({
    email: 'test@example.com',
    name: 'Ada',
    position: 42,
    useCase: 'evaluating decision rehearsal for a hospital triage scenario',
  });
  assert.match(out.html, /#42/);
  assert.match(out.html, /paracosm\.agentos\.sh/);
  assert.match(out.html, /team@frame\.dev/);
  assert.match(out.html, /https:\/\/frame\.dev\/icon-192\.png/);
  assert.match(out.html, /github\.com\/framersai\/paracosm/);
  assert.match(out.text, /#42/);
  assert.match(out.text, /paracosm\.agentos\.sh/);
  assert.equal(out.subject, "You're on the Paracosm waitlist (#42)");
});

test('renderWaitlistConfirmation tolerates empty optional fields', () => {
  const out = renderWaitlistConfirmation({
    email: 'a@b.co',
    name: null,
    position: 1,
    useCase: null,
  });
  assert.match(out.html, /#1/);
  assert.match(out.html, /a@b\.co/);
  assert.doesNotMatch(out.html, /undefined/);
  assert.doesNotMatch(out.html, /null/);
});

test('renderWaitlistConfirmation HTML uses inline styles only (no <style> blocks)', () => {
  const out = renderWaitlistConfirmation({
    email: 'a@b.co',
    name: 'A',
    position: 7,
    useCase: 'x',
  });
  assert.doesNotMatch(out.html, /<style/i);
});

test('renderWaitlistConfirmation HTML-escapes user input to prevent injection', () => {
  const out = renderWaitlistConfirmation({
    email: 'a@b.co',
    name: '<script>alert(1)</script>',
    position: 1,
    useCase: '<img src=x onerror=alert(1)>',
  });
  // Raw < and > from user input must be escaped; any browser parsing
  // the HTML will render the escaped sequence as text, not as a tag.
  assert.doesNotMatch(out.html, /<script>alert/);
  assert.doesNotMatch(out.html, /<img src=x onerror=/);
  assert.match(out.html, /&lt;script&gt;/);
  assert.match(out.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
