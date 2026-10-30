import { api, enabled } from '../api.js';
import { h, heading, empty } from '../ui.js';
export async function versionsPage() {
  if (!enabled('versions')) return empty('Histórico indisponível');
  const release = await api('/versions');
  return (
    heading(
      'Evolução da plataforma',
      'Estatísticas para Nerds',
      'Um resumo das versões e das principais mudanças do site.',
    ) +
    `<article class="card accent-block"><div class="meta">Versão no ar</div><h2>${h(release.version)}</h2></article><div class="publication-thread">${release.history.map((v) => `<article class="card thread-reply"><div class="meta">${h(v.date)}</div><h2>${h(v.version)} · ${h(v.title)}</h2><p>${h(v.summary)}</p></article>`).join('')}</div>`
  );
}
