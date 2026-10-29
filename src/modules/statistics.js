import { BRAZIL_STATES } from '../../shared/assistant.js';
import { api, enabled } from '../api.js';
import { h, heading, empty, icon, select } from '../ui.js';

let period = null,
  currentReport = null;
const colors = ['#30b5a5', '#d29b5b', '#688ddd', '#bc78b9', '#8ba759', '#df846a'];
function bars(title, values, monthly = false) {
  const maximum = Math.max(1, ...values.map((v) => v.value));
  return `<article class="card stats-chart"><h2>${h(title)}</h2>${
    values.length
      ? `<div class="stats-bars" role="list">${values.map((v, i) => `<div class="stats-row" role="listitem"><div><span>${h(v.label)}</span><strong>${h(v.value)}</strong></div><div class="stats-track"><span style="width:${Math.max(v.value ? 1 : 0, (v.value / maximum) * 100)}%;background:${colors[monthly ? 0 : i % colors.length]}"></span></div></div>`).join('')}</div>`
      : '<p class="muted">Ainda não há dados suficientes para exibir este gráfico.</p>'
  }</article>`;
}
function donut(values) {
  const total = values.reduce((sum, v) => sum + v.value, 0);
  if (!total)
    return `<article class="card stats-chart"><h2>Composição do catálogo</h2><p>Nenhuma publicação neste período.</p></article>`;
  let offset = 0;
  const arcs = values
    .map((v, i) => {
      const fraction = (v.value / total) * 100;
      const arc = `<circle cx="60" cy="60" r="45" fill="none" stroke="${colors[i % colors.length]}" stroke-width="16" pathLength="100" stroke-dasharray="${fraction} ${100 - fraction}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
      offset += fraction;
      return arc;
    })
    .join('');
  return `<article class="card stats-chart"><h2>Composição do catálogo</h2><div class="stats-donut"><svg viewBox="0 0 120 120" role="img" aria-label="Distribuição por categoria; valores na legenda">${arcs}<text x="60" y="63" text-anchor="middle" fill="currentColor" font-size="14">${total}</text></svg><ul>${values.map((v, i) => `<li><span class="stats-dot" style="background:${colors[i % colors.length]}"></span>${h(v.label)}: <strong>${v.value}</strong> (${((v.value / total) * 100).toFixed(1)}%)</li>`).join('')}</ul></div></article>`;
}
export async function statisticsPage() {
  if (!enabled('statistics')) return empty('Estatísticas indisponíveis');
  const report = await api('/statistics' + (period ? '?' + new URLSearchParams(period) : ''));
  currentReport = report;
  return (
    heading(
      'Observatório da comunidade',
      'Estatísticas',
      'Publicações e interesses registrados no Voz do Professor, com origem e limites claros.',
    ) +
    `<article class="card"><form data-form="statistics" class="form-grid"><label>De<input type="month" name="from" value="${h(report.from)}" required></label><label>Até<input type="month" name="to" value="${h(report.to)}" required></label>${select('state', 'Estado das publicações e consultas', BRAZIL_STATES, report.state)}${select('category', 'Categoria das publicações', ['Notícia', 'Legislação', 'Relatos', 'Pesquisas publicadas', 'Concurso público', 'Processo simplificado'], report.category)}<button class="button primary">Aplicar filtros</button>${enabled('statisticsExport') ? '<button class="button" name="action" value="pdf">Baixar relatório em PDF</button>' : ''}</form><p class="muted">Períodos de até 24 meses. Categoria filtra o catálogo, não os assuntos consultados. Estado filtra ambos; publicações nacionais sem estado não são atribuídas a uma UF. Publicações pela data de entrada no site; consultas pelo mês em Brasília.</p></article>
    <div class="grid stats-totals"><article class="card"><div class="meta">Publicações visíveis</div><strong>${report.total}</strong></article><article class="card"><div class="meta">Relatos publicados</div><strong>${report.stories}</strong></article><article class="card"><div class="meta">Pesquisas publicadas</div><strong>${report.surveys}</strong></article></div>
    <div class="grid stats-grid">${donut(report.types)}${bars('Publicações por mês', report.timeline, true)}${bars('Localidade das publicações', report.places)}${bars('Assuntos mais consultados com IA', report.queryTopics)}${bars('Estados informados nas consultas', report.queryPlaces)}${bars('Consultas por mês', report.queryTimeline, true)}</div>
    <article class="card accent-block"><div class="meta">${icon('sparkles')} Leitura dos números por IA</div>${report.insight ? `<p>${h(report.insight.summary)}</p><p class="muted">${h(report.insight.model)} · ${h(new Date(report.insight.generatedAt).toLocaleString('pt-BR'))} · ${h(report.from)} a ${h(report.to)}</p>` : '<p>A interpretação automática é atualizada no ciclo diário para os últimos 12 meses. Ela aparece quando corresponde exatamente aos dados exibidos. Outros períodos continuam disponíveis nos gráficos, sem gerar novas cobranças.</p>'}</article>
    <article class="card"><h2>Como interpretar</h2><p>Fonte: catálogo público do Voz do Professor e contadores agregados das consultas concluídas. Antes de 29/10/2026, a contribuição era opcional; a partir da versão 3.2, a confirmação estatística é requisito para consultar a IA. Essa mudança limita comparações históricas. Categorias de consultas só aparecem a partir de cinco registros; ausência no gráfico não significa zero. Não são visitantes únicos e a amostra não representa todos os professores.</p><p>Uma pesquisa publicada é um convite ou formulário, não uma resposta recebida. O site não recebe os formulários enviados por e-mail. Relatos são contados sem analisar seu texto ou atribuir sentimentos e opiniões a autores. As localizações são as das publicações ou o estado escolhido na consulta, nunca GPS.</p><p>Os gráficos são calculados diretamente dos registros; a IA interpreta somente os totais. Conteúdo retirado ou ferramentas desativadas deixam de participar. Ler esta página e filtrar meses não aciona a IA.</p></article>`
  );
}
export function setStatisticsPeriod(form) {
  const values = Object.fromEntries(new FormData(form));
  if (values.from > values.to) throw new Error('O mês inicial deve vir antes do mês final.');
  period = {
    from: values.from,
    to: values.to,
    state: values.state || '',
    category: values.category || '',
  };
}

export async function exportStatistics() {
  if (!enabled('statistics') || !enabled('statisticsExport') || !currentReport) return;
  const { buildStatisticsPdf } = await import('./statistics-pdf.js');
  const pdf = await buildStatisticsPdf(currentReport);
  pdf.save(`voz-do-professor-estatisticas-${currentReport.from}-${currentReport.to}.pdf`);
}
