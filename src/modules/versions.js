import { api, enabled } from '../api.js';
import { h, heading, external, empty } from '../ui.js';
export async function versionsPage() {
  if (!enabled('versions')) return empty('Histórico indisponível');
  const release = await api('/versions');
  return (
    heading(
      'Evolução da plataforma',
      'Versões e mudanças',
      'Veja o que foi acrescentado, corrigido e publicado em cada etapa do projeto.',
    ) +
    `<article class="card accent-block"><div class="meta">Versão no ar</div><h2>${h(release.version)}</h2>${release.commit ? external('https://github.com/anddrad3/voz-do-professor/commit/' + release.commit, 'Código publicado no GitHub') : ''}</article><div class="publication-thread">${release.history.map((v) => `<article class="card thread-reply"><div class="meta">${h(v.date)} · ${h(v.status)}</div><h2>${h(v.version)} · ${h(v.title)}</h2><ul>${v.changes.map((c) => `<li>${h(c)}</li>`).join('')}</ul></article>`).join('')}</div><p class="muted">Os marcos iniciais foram nomeados retrospectivamente a partir do GitHub; não são tags históricas.</p>`
  );
}
