import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

test('privacy page publishes a complete customer-facing policy instead of a launch draft', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const css = await readFile(new URL('commercial.css', root), 'utf8');

  assert.doesNotMatch(app, /This launch draft identifies|Replace this summary with counsel-reviewed terms/);
  for (const text of [
    'Effective date: September 21, 2026',
    'Information we collect',
    'How we use information',
    'AI-assisted features',
    'When we share information',
    'Data retention',
    'Your privacy rights and choices',
    'Children and family content',
    'California and other U.S. state privacy disclosures',
    'Contact us',
  ]) assert.match(app, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(app, /OpenAI/);
  assert.match(app, /support@familychronica\.com/);
  assert.match(css, /\.privacy-summary-grid/);
  assert.match(css, /\.privacy-toc/);
});
