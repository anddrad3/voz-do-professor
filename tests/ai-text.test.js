import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAiText } from '../shared/ai-text.js';
test('resposta formatada mantém links HTTPS e não executa HTML ou URLs perigosas', () => {
  const html = formatAiText(
    '### Vagas\n* **Professor**\n[Edital](https://example.org/?a=1&b=2)\n<script>alert(1)</script>\n[ruim](javascript:alert(1))\n[x](https://user:password@example.org)',
  );
  assert.match(html, /<h3>Vagas<\/h3>/);
  assert.match(html, /<ul><li><strong>Professor<\/strong><\/li><\/ul>/);
  assert.match(html, /href="https:\/\/example.org\/\?a=1&amp;b=2"/);
  assert.ok(
    !html.includes('<script>') &&
      !html.includes('href="javascript:') &&
      !html.includes('href="https://user:'),
  );
});
