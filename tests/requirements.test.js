import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('matriz cobre exatamente os 66 identificadores e aponta para módulos existentes', () => {
  const rows = JSON.parse(readFileSync('docs/requisitos.json', 'utf8'));
  const expected = [9, 12, 14, 14, 7, 10].flatMap((count, index) =>
    Array.from({ length: count }, (_, i) => `${index + 1}.${i + 1}`),
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    expected,
  );
  for (const row of rows) {
    assert.ok(row.title && row.implementation && row.verification);
    for (const file of row.files.split('; ')) assert.ok(existsSync(file), file);
  }
});
