import { api, loadRecords, state } from '../api.js';
import {
  h,
  icon,
  heading,
  card,
  empty,
  field,
  select,
  textarea,
  notice,
  check,
  dialog,
  toast,
  download,
  csv,
  fmtDate,
} from '../ui.js';
export const TOPICS = [
  'Jornada',
  'Vínculos',
  'Remuneração',
  'Infraestrutura',
  'Materiais didáticos',
  'Inteligência artificial',
  'Outros',
];
const consent =
  'Li a finalidade da coleta e autorizo o uso das minhas respostas de forma agregada. Sei que posso retirá-las com o comprovante.';
export async function voice() {
  const surveys = await loadRecords('survey');
  return (
    heading(
      'Escuta e valorização',
      'A educação também precisa ouvir.',
      'Compartilhe experiências e ajude a compreender as condições reais do trabalho docente.',
      `<button class="button primary" data-action="new-story">${icon('message-square-plus')}Compartilhar relato</button>`,
    ) +
    notice(
      'Sua participação é voluntária. Não informe nomes, contatos ou detalhes que identifiquem você, estudantes ou colegas. Relatos individuais não são publicados.',
    ) +
    `<div class="toolbar"><a class="chip active" href="#/voz">Pesquisas e enquetes</a><a class="chip" href="#/resultados">Painel coletivo</a><button class="chip" data-action="new-suggestion">Sugerir melhorias</button><button class="chip" data-action="withdraw">Retirar participação</button></div><div class="masonry">${surveys.length ? surveys.map((r) => card(r, state)).join('') : empty('Nenhuma pesquisa aberta', 'Novas pesquisas aparecerão aqui depois da publicação pela equipe.')}</div>`
  );
}
export async function survey(id) {
  const r = await api(`/record/${encodeURIComponent(id)}`);
  state.records.set(r.id, r);
  const closed =
    r.closes &&
    r.closes < new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return `<div class="reading"><a class="button small ghost" href="#/voz">${icon('arrow-left')}Todas as pesquisas</a>${heading(r.topic, r.title, r.purpose)}${r.demo ? notice('Instrumento de demonstração. As respostas coletadas neste ambiente não constituem uma pesquisa científica.') : ''}${notice('Não coletamos seu nome, e-mail, conta ou localização precisa nesta pesquisa. Informe apenas município e estado. O comprovante é a única forma de retirar uma resposta anônima.')}<article class="card">${closed ? empty('Pesquisa encerrada', `Encerramento em ${fmtDate(r.closes)}.`) : `<form data-form="survey" data-id="${h(r.id)}" class="stack">${field('territory', 'Município / UF', '', 'text', 'required placeholder="Ex.: Franca / SP" maxlength="160"')}<div class="stack">${r.questions.map((q) => `<fieldset style="border:1px solid var(--line);border-radius:12px;padding:18px"><legend>${h(q.label)}</legend><div class="stack">${q.options.map((o) => `<label class="check"><input type="radio" name="question:${h(q.id)}" value="${h(o)}" required><span>${h(o)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>${check('consent', consent)}<p class="small-text muted">Não envie a mesma pesquisa mais de uma vez. Por proteção do anonimato, não vinculamos sua resposta à conta.</p><button class="button primary">Enviar resposta anônima</button></form>`}<div class="form-actions"><a class="button" href="#/resultados">${icon('chart-no-axes-combined')}Ver resultados coletivos</a></div></article></div>`;
}
export function story(kind = 'Relato') {
  dialog(
    kind === 'Relato' ? 'Sua experiência importa' : 'O que podemos melhorar?',
    `${notice('Finalidade: compreender condições de trabalho e melhorar a plataforma. O texto fica restrito à equipe autorizada, protegido por criptografia. Não inclua nomes nem contatos.')}<form data-form="story" class="stack"> <input name="kind" type="hidden" value="${kind}">${field('territory', 'Município / UF', '', 'text', 'required maxlength="160" placeholder="Ex.: Franca / SP"')}${select('category', 'Tema', TOPICS, 'Outros', false)}${textarea('body', kind === 'Relato' ? 'Conte sua experiência, sem identificar pessoas' : 'Sua sugestão', '', 'required minlength="20" maxlength="6000"')}${check('consent', consent)}<button class="button primary">Enviar ${kind === 'Relato' ? 'relato anônimo' : 'sugestão'}</button></form>`,
  );
}
export function showReceipt(receipt) {
  document.querySelector('#dialog').close();
  dialog(
    'Participação recebida',
    `<p class="muted">Guarde este comprovante. Ele permite retirar sua participação sem que você precise se identificar.</p><p class="receipt" style="margin-top:18px">${h(receipt)}</p><div class="form-actions"><button class="button primary" data-action="download-receipt" data-receipt="${h(receipt)}">${icon('download')}Baixar comprovante</button><button class="button" data-action="close-dialog">Concluir</button></div>`,
  );
}
export function withdrawal() {
  dialog(
    'Retirar participação',
    `<p class="muted small-text">A exclusão remove a resposta ou relato correspondente e atualiza os resultados agregados. Não será possível recuperá-lo.</p><form data-form="withdraw" class="stack" style="margin-top:20px">${field('receipt', 'Comprovante de participação', '', 'text', 'required pattern="[a-f0-9]{64}" minlength="64" maxlength="64"')}${check('confirm', 'Confirmo que desejo excluir esta participação.')}<button class="button danger">Excluir minha participação</button></form>`,
  );
}
function groupResults(g) {
  if (g.suppressed)
    return notice(
      'Resultados protegidos: aguardando volume suficiente de respostas. O mínimo é de 10 participantes por grupo.',
    );
  return `<p class="small-text muted">${g.total} respostas voluntárias</p>${g.questions.map((q) => (q.suppressed ? `<h3 style="margin-top:20px">${h(q.label)}</h3>${notice('Distribuição ocultada: uma ou mais opções têm menos de 10 respostas.')}` : `<div class="result"><h3>${h(q.label)}</h3>${q.counts.map((c) => `<div class="result-row"><span>${h(c.option)}</span><span>${c.count} · ${Math.round((c.count / g.total) * 100)}%</span></div><div class="bar"><span style="width:${Math.round((c.count / g.total) * 100)}%"></span></div>`).join('')}</div>`)).join('')}`;
}
export async function results() {
  const report = await api('/research/report');
  state.report = report;
  return (
    heading(
      'Conhecimento coletivo',
      'O que as vozes revelam.',
      'Resultados agregados e protegidos, com devolutiva para a comunidade docente.',
      `<div class="row"><button class="button" data-action="report-csv">${icon('download')}CSV</button><button class="button" data-action="report-json">JSON</button><button class="button" data-action="print">${icon('printer')}Relatório / PDF</button></div>`,
    ) +
    notice(report.methodology) +
    `<div class="toolbar"><a class="chip" href="#/voz">Participar das pesquisas</a><span class="spacer"></span><span class="small-text muted">Atualizado em ${fmtDate(report.generatedAt)}</span></div><div class="masonry">${report.surveys.map((s) => `<article class="card"><h3>${h(s.title)}</h3>${groupResults(s.nationwide)}<details><summary>Resultados por território</summary>${s.territoriesSuppressed ? notice('Recortes territoriais ocultados para impedir a identificação de grupos pequenos.') : s.territories.length ? s.territories.map((t) => `<h3 style="margin-top:20px">${h(t.territory)}</h3>${groupResults(t)}`).join('') : notice('Ainda não há recortes territoriais disponíveis.')}</details></article>`).join('') || empty('Resultados ainda indisponíveis', 'Acompanhe as pesquisas que serão publicadas.')}<article class="card"><h3>Condições de trabalho nos relatos</h3>${report.submissions.suppressed ? notice('Aguardando volume suficiente de relatos revisados. Nenhum texto individual é divulgado.') : `<p>${report.submissions.total} relatos revisados</p>${report.submissions.categories.map((c) => `<div class="result-row"><span>${h(c.category)}</span><strong>${c.count}</strong></div>`).join('')}`}</article></div>`
  );
}
export function reportCSV() {
  const rows = [['Pesquisa', 'Território', 'Pergunta', 'Opção', 'Respostas', 'Observação']];
  for (const s of state.report.surveys) {
    for (const [territory, g] of [
      ['Nacional', s.nationwide],
      ...s.territories.map((t) => [t.territory, t]),
    ]) {
      if (g.suppressed) {
        rows.push([s.title, territory, '', '', '', 'Protegido: amostra insuficiente']);
        continue;
      }
      for (const q of g.questions) {
        if (q.suppressed)
          rows.push([s.title, territory, q.label, '', '', 'Distribuição suprimida']);
        else
          for (const c of q.counts)
            rows.push([s.title, territory, q.label, c.option, c.count, 'Amostra voluntária']);
      }
    }
  }
  const subs = state.report.submissions;
  if (!subs.suppressed)
    for (const c of subs.categories)
      rows.push(['Relatos revisados', 'Nacional', 'Tema', c.category, c.count, 'Somente agregado']);
  download('voz-do-professor-resultados.csv', csv(rows), 'text/csv;charset=utf-8');
}
export async function submitVoice(type, form, values) {
  if (type === 'survey') {
    if (!values.consent) throw new Error('O consentimento é necessário para participar.');
    const answers = Object.fromEntries(
      Object.entries(values)
        .filter(([k]) => k.startsWith('question:'))
        .map(([k, v]) => [k.slice(9), v]),
    );
    const result = await api('/research/responses', {
      method: 'POST',
      body: {
        surveyId: form.dataset.id,
        territory: values.territory.trim(),
        answers,
        consent: true,
      },
    });
    form.reset();
    showReceipt(result.receipt);
    return true;
  }
  if (type === 'story') {
    if (!values.consent) throw new Error('O consentimento é necessário para participar.');
    const result = await api('/research/submissions', {
      method: 'POST',
      body: { ...values, consent: true },
    });
    showReceipt(result.receipt);
    return true;
  }
  if (type === 'withdraw') {
    if (!values.confirm) throw new Error('Confirme a exclusão da participação.');
    await api('/research/withdraw', { method: 'POST', body: { receipt: values.receipt } });
    document.querySelector('#dialog').close();
    toast('Participação excluída.');
    return true;
  }
  return false;
}
