import { api, state } from '../api.js';
import {
  h,
  heading,
  icon,
  field,
  select,
  textarea,
  check,
  notice,
  empty,
  dialog,
  toast,
  fmtDate,
  download,
  csv,
  external,
} from '../ui.js';
import { TYPES, LEVELS, STATES, OPPORTUNITY_TYPES } from './catalog.js';
const tabs = [
  ['content', 'Notícias e direitos'],
  ['school', 'Instituições'],
  ['opportunity', 'Editais'],
  ['survey', 'Pesquisas'],
  ['imports', 'Importações'],
  ['quality', 'Qualidade'],
  ['submissions', 'Escuta'],
  ['statistics', 'Indicadores'],
  ['privacy', 'Privacidade'],
];
const topics = [
  'Enquete',
  'Jornada',
  'Vínculos',
  'Remuneração',
  'Infraestrutura',
  'Materiais didáticos',
  'Inteligência artificial',
];
const recordFields = {
  content: ['type', 'summary', 'level', 'salary', 'year', 'hours', 'history'],
  school: [
    'cnpj',
    'inepCode',
    'cnae',
    'network',
    'address',
    'phone',
    'website',
    'recruitmentUrl',
    'recruitmentVerified',
    'lat',
    'lng',
    'active',
    'crosscheck',
    'provenance',
  ],
  opportunity: [
    'type',
    'discipline',
    'level',
    'education',
    'salary',
    'hours',
    'opens',
    'closes',
    'examDate',
    'stage',
    'registrationUrl',
    'requirements',
    'documents',
    'lat',
    'lng',
  ],
  survey: ['topic', 'purpose', 'closes', 'questions'],
};
const baseFields = [
  'title',
  'body',
  'city',
  'state',
  'sourceName',
  'sourceUrl',
  'sourceDate',
  'tags',
];
function editForm(kind, record = {}) {
  const v = (key, def = '') => record[key] ?? def;
  let extra = '';
  if (kind === 'content')
    extra =
      select('type', 'Tipo de informação', TYPES, v('type', 'Notícia'), false) +
      select('level', 'Nível de ensino', LEVELS, v('level', 'Todos'), false) +
      textarea('summary', 'Explicador em linguagem simples', v('summary')) +
      field('salary', 'Piso / remuneração (R$)', v('salary'), 'number', 'step="0.01" min="0"') +
      field('year', 'Ano de referência', v('year'), 'number', 'min="1900" max="2200"') +
      field('hours', 'Jornada semanal (horas)', v('hours'), 'number', 'min="1" max="80"') +
      textarea(
        'history',
        'Mudanças na norma: uma por linha (data | descrição | link oficial)',
        v('history', [])
          .map((i) => `${i.date} | ${i.description} | ${i.sourceUrl}`)
          .join('\n'),
        'placeholder="2026-01-01 | Descrição da alteração | https://..."',
      );
  if (kind === 'school')
    extra =
      select(
        'network',
        'Rede de ensino',
        ['Municipal', 'Estadual', 'Federal', 'Privada', 'Não informada'],
        v('network', 'Não informada'),
        false,
      ) +
      field('cnpj', 'CNPJ', v('cnpj'), 'text', 'maxlength="14"') +
      field('inepCode', 'Código Inep', v('inepCode')) +
      field('cnae', 'CNAE', v('cnae')) +
      field('address', 'Endereço público', v('address')) +
      field('phone', 'Contato público da instituição', v('phone')) +
      field('website', 'Site institucional', v('website'), 'url') +
      field('recruitmentUrl', 'Canal oficial de candidatura', v('recruitmentUrl'), 'url') +
      field('lat', 'Latitude', v('lat'), 'number', 'step="any" min="-90" max="90"') +
      field('lng', 'Longitude', v('lng'), 'number', 'step="any" min="-180" max="180"') +
      select(
        'crosscheck',
        'Cruzamento de bases',
        [
          'Não cruzado',
          'Correspondência por CNPJ',
          'Correspondência por INEP',
          'Revisão necessária',
        ],
        v('crosscheck', 'Não cruzado'),
        false,
      ) +
      `<div class="stack">${check('active', 'Instituição em atividade', v('active', true))}${check('recruitmentVerified', 'Conferi o canal de candidatura na fonte oficial', v('recruitmentVerified', false))}</div>`;
  if (kind === 'opportunity')
    extra =
      select('type', 'Modalidade', OPPORTUNITY_TYPES, v('type', 'Concurso público'), false) +
      field('discipline', 'Disciplina', v('discipline'), 'text', 'required') +
      select('level', 'Nível', LEVELS, v('level', 'Ensino Fundamental'), false) +
      field('education', 'Escolaridade exigida', v('education'), 'text', 'required') +
      field('salary', 'Remuneração (R$)', v('salary'), 'number', 'min="0" step="0.01"') +
      field('hours', 'Jornada semanal', v('hours'), 'number', 'min="1" max="80"') +
      field('opens', 'Abertura das inscrições', v('opens'), 'date', 'required') +
      field('closes', 'Encerramento das inscrições', v('closes'), 'date', 'required') +
      field('examDate', 'Data de prova', v('examDate'), 'date') +
      select(
        'stage',
        'Situação do edital',
        ['Automático', 'Em andamento', 'Suspenso', 'Finalizado'],
        v('stage', 'Automático'),
        false,
      ) +
      field('registrationUrl', 'Página oficial de inscrição', v('registrationUrl'), 'url') +
      field('lat', 'Latitude', v('lat'), 'number', 'step="any" min="-90" max="90"') +
      field('lng', 'Longitude', v('lng'), 'number', 'step="any" min="-180" max="180"') +
      textarea('requirements', 'Requisitos', v('requirements'), 'required') +
      textarea('documents', 'Documentação', v('documents'));
  if (kind === 'survey')
    extra =
      select('topic', 'Tema', topics, v('topic', 'Enquete'), false) +
      field('closes', 'Encerramento da coleta', v('closes'), 'date') +
      textarea(
        'purpose',
        'Finalidade declarada ao participante',
        v('purpose'),
        'required minlength="10"',
      ) +
      textarea(
        'questions',
        'Perguntas: uma por linha (código | pergunta | opção 1 | opção 2...)',
        v('questions', [])
          .map((q) => [q.id, q.label, ...q.options].join(' | '))
          .join('\n'),
        'required placeholder="jornada | Quantas horas trabalha? | Até 20 | De 21 a 40 | Mais de 40"',
      ) +
      `<div class="wide">${notice('Use somente respostas por categorias. Evite perguntas que identifiquem pessoas. Após a primeira resposta, as perguntas ficam bloqueadas; crie outra pesquisa para mudar o instrumento.')}</div>`;
  return `<article class="card"><div class="section-title"><h2>${record.id ? 'Editar registro' : 'Novo registro'}</h2><button class="button small" data-action="admin-cancel">Cancelar</button></div>${notice('Salvar cria um rascunho. A publicação exige uma revisão explícita por pessoa responsável; editar um item publicado o retira do ar até nova validação.')}<form data-form="admin-record" data-kind="${kind}" data-id="${h(record.id || '')}"><div class="form-grid two">${field('title', 'Título / nome', v('title'), 'text', 'required minlength="3" maxlength="240"')}${field('city', 'Município', v('city'))}${select('state', 'Estado', STATES, v('state'))}${field('sourceName', 'Nome da fonte', v('sourceName'))}${field('sourceUrl', 'Link da fonte / edital oficial', v('sourceUrl'), 'url')}${field('sourceDate', 'Data de conferência da fonte', v('sourceDate'), 'date')}${field('tags', 'Assuntos (separados por vírgulas)', v('tags', []).join(', '))}${textarea('body', 'Texto / apresentação', v('body'))}${extra}</div><div class="form-actions"><button class="button primary">Salvar rascunho</button></div></form></article>`;
}
export async function admin() {
  if (state.user?.role !== 'admin')
    return (
      heading(
        'Área restrita',
        'Administração',
        'Entre com uma conta administrativa para continuar.',
      ) + `<a class="button" href="#/perfil">Entrar</a>`
    );
  let body = '';
  const tab = state.adminTab;
  if (recordFields[tab]) {
    const list = await api(`/admin/records/${tab}`);
    state.adminRecords = list;
    list.forEach((r) => state.records.set(r.id, r));
    if (state.adminEdit !== null)
      body = editForm(tab, list.find((r) => r.id === state.adminEdit) || {});
    else
      body = `<div class="section-title"><h2>${tabs.find((t) => t[0] === tab)[1]}</h2><button class="button primary" data-action="admin-new">${icon('plus')}Novo registro</button></div>${list.length ? `<div class="table-wrap"><table><thead><tr><th>Título</th><th>Estado</th><th>Curadoria</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>${list.map((r) => `<tr><td>${h(r.title)}${r.demo ? ' <span class="badge demo">Demo</span>' : ''}</td><td>${h({ draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' }[r.status])}</td><td>${h(r.reviewer || 'Pendente')}</td><td>${fmtDate(r.updatedAt)}</td><td><div class="row"><button class="button small" data-action="admin-edit" data-id="${h(r.id)}">Editar</button><button class="button small" data-action="admin-review" data-id="${h(r.id)}">Revisar</button><button class="button small" data-action="admin-history" data-id="${h(r.id)}">Histórico</button>${r.status !== 'archived' ? `<button class="button small" data-action="admin-archive" data-id="${h(r.id)}">Arquivar</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum registro cadastrado', 'Crie o primeiro rascunho ou importe os dados.')}`;
  } else if (tab === 'imports') {
    const overview = await api('/admin/overview');
    body = `<article class="card"><h2>Importar bases e conteúdos</h2><p>CSV normalizado, estabelecimentos da Receita Federal ou microdados do Censo Escolar. Registros importados entram em rascunho para revisão humana.</p><form data-form="admin-import" class="stack" style="margin-top:20px"><div class="form-grid">${select(
      'kind',
      'Destino',
      [
        ['school', 'Instituições'],
        ['content', 'Notícias e direitos'],
        ['opportunity', 'Editais'],
        ['survey', 'Pesquisas'],
      ],
      'school',
      false,
    )}${select(
      'format',
      'Formato',
      [
        ['normalized', 'CSV normalizado (com cabeçalho)'],
        ['cnpj', 'CNPJ / Estabelecimentos (sem cabeçalho)'],
        ['census', 'Censo Escolar (com cabeçalho)'],
      ],
      'normalized',
      false,
    )}${select(
      'delimiter',
      'Separador',
      [
        [';', 'Ponto e vírgula'],
        [',', 'Vírgula'],
      ],
      ';',
      false,
    )}${field('sourceDate', 'Data de referência da base', '', 'date', 'required')}${select(
      'encoding',
      'Codificação do arquivo',
      [
        ['utf-8', 'UTF-8'],
        ['windows-1252', 'Latin-1 / Windows-1252'],
      ],
      'utf-8',
      false,
    )}<label class="field">Arquivo CSV (até 8 MB)<input type="file" name="file" accept=".csv,.txt" required></label></div><p class="small-text muted">Para bases nacionais grandes, use a rotina de importação por fluxo e o manifesto documentado no repositório. O arquivo de municípios da Receita resolve os códigos territoriais.</p><button class="button primary">Importar e verificar</button></form></article><h2>Histórico de execuções</h2><div class="stack" style="margin-top:20px">${overview.imports.map((j) => `<article class="card"><h3>${h(j.source)} · ${h(j.status)}</h3><p>${fmtDate(j.started_at)}</p><pre>${h(JSON.stringify(j.summary, null, 2))}</pre></article>`).join('') || empty('Nenhuma importação realizada')}</div>`;
  } else if (tab === 'quality') {
    const issues = await api('/admin/quality');
    state.quality = issues;
    body = `<div class="section-title"><h2>${issues.length} apontamentos de qualidade</h2><button class="button" data-action="quality-export">${icon('download')}Exportar CSV</button></div>${notice('São sinalizados identificadores duplicados, fontes com mais de 180 dias, falta de coordenadas e divergências entre bases. O responsável deve conferir e corrigir os registros.')}<div class="stack">${issues.map((i) => `<article class="notification"><div class="content"><h3>${h(i.title)}</h3><p class="muted small-text">${h(i.issue)}</p></div><button class="button small" data-action="quality-edit" data-id="${h(i.id)}">Revisar instituição</button></article>`).join('') || empty('Nenhum apontamento encontrado', 'Os critérios automáticos não substituem a verificação humana.')}</div>`;
  } else if (tab === 'submissions') {
    const items = await api('/admin/submissions');
    body =
      notice(
        'Acesso restrito à equipe autorizada. Não copie textos identificáveis para publicações. Apenas relatos revisados entram nos totais agregados.',
      ) +
      `<div class="masonry">${items.map((s) => `<article class="card"><div class="meta">${h(s.kind)} · ${h(s.category)} · ${h(s.period)}</div><h3>${h(s.territory)}</h3><p>${h(s.body)}</p><p class="small-text muted">Situação: ${h(s.status)}</p><div class="form-actions"><button class="button small" data-action="review-submission" data-id="${h(s.id)}" data-status="reviewed">Revisado</button><button class="button small" data-action="review-submission" data-id="${h(s.id)}" data-status="rejected">Excluir do agregado</button></div></article>`).join('') || empty('Nenhum relato recebido')}</div>`;
  } else if (tab === 'statistics') {
    const o = await api('/admin/overview');
    body = `<div class="stat-grid"><div class="stat"><strong>${o.users}</strong><span>Contas cadastradas</span></div><div class="stat"><strong>${o.responses}</strong><span>Respostas coletadas</span></div><div class="stat"><strong>${o.records.reduce((a, b) => a + b.total, 0)}</strong><span>Registros editoriais</span></div><div class="stat"><strong>${o.usage.reduce((a, b) => a + b.requests, 0)}</strong><span>Carregamentos de página · últimos 30 dias</span></div></div><div class="grid"><article class="card"><h3>Acervo por módulo e situação</h3>${o.records.map((r) => `<div class="result-row"><span>${h(tabs.find((t) => t[0] === r.kind)?.[1] || r.kind)} · ${h(r.status)}</span><strong>${r.total}</strong></div>`).join('')}</article><article class="card"><h3>Resultados e relatórios protegidos</h3><p>As exportações públicas e administrativas de pesquisas usam os mesmos agregados e regras de supressão. Não há exportação de respostas individuais.</p><a class="button" style="margin-top:20px" href="#/resultados">Abrir relatórios</a></article></div><div class="table-wrap"><table><thead><tr><th>Dia</th><th>Carregamentos (sem identificadores)</th></tr></thead><tbody>${o.usage.map((r) => `<tr><td>${fmtDate(r.day)}</td><td>${r.requests}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (tab === 'privacy') {
    const requests = await api('/admin/privacy-requests');
    body = `<div class="stack">${requests.map((p) => `<article class="card"><div class="meta">${h(p.kind)} · ${h(p.status)} · ${fmtDate(p.created_at)}</div><h3>${h(p.name)}</h3><p>${h(p.email)}</p><p>${h(p.body)}</p><p class="small-text">Protocolo: ${h(p.id)}</p>${p.status !== 'resolved' ? `<button class="button" data-action="resolve-privacy" data-id="${h(p.id)}" style="margin-top:15px">Marcar como atendida</button>` : ''}</article>`).join('') || empty('Nenhuma solicitação pendente')}</div>`;
  }
  return (
    heading(
      'Gestão e responsabilidade',
      'Administração',
      'Curadoria identificada, qualidade dos dados e cuidado com a comunidade.',
    ) +
    `<div class="tabs">${tabs.map(([key, label]) => `<button class="chip ${tab === key ? 'active' : ''}" data-action="admin-tab" data-tab="${key}">${label}</button>`).join('')}</div>` +
    body
  );
}
export async function adminAction(action, el, ctx) {
  const id = el.dataset.id;
  if (action === 'admin-tab') {
    state.adminTab = el.dataset.tab;
    state.adminEdit = null;
  } else if (action === 'admin-new') state.adminEdit = '';
  else if (action === 'admin-cancel') state.adminEdit = null;
  else if (action === 'admin-edit') state.adminEdit = id;
  else if (action === 'quality-edit') {
    state.adminTab = 'school';
    state.adminEdit = id;
  } else if (action === 'admin-review') {
    const r = state.records.get(id);
    dialog(
      'Conferência antes da publicação',
      `<h3>${h(r.title)}</h3><p class="muted" style="margin:15px 0;white-space:pre-wrap">${h(r.body)}</p>${r.summary ? `<p>${h(r.summary)}</p>` : ''}${external(r.sourceUrl, 'Abrir fonte para conferir')}<p class="small-text muted" style="margin-top:15px">Responsável público: ${h(state.user.name)}. Data da fonte: ${fmtDate(r.sourceDate)}.</p><form class="stack" data-form="admin-publish" data-id="${h(id)}" style="margin-top:20px">${check('attestation', 'Li o registro, conferi a fonte e assumo a responsabilidade pela validação humana desta publicação.')}<button class="button primary">Validar e publicar</button></form>`,
    );
    return true;
  } else if (action === 'admin-history') {
    const list = await api(`/admin/history/${encodeURIComponent(id)}`);
    dialog(
      'Histórico de alterações',
      `<div class="stack">${list.map((i) => `<div><h3>${h(i.action)} · ${h(i.actor)}</h3><small>${fmtDate(i.created_at)}</small><details><summary>Conteúdo registrado nesta revisão</summary><pre>${h(JSON.stringify(i.data, null, 2))}</pre></details></div>`).join('')}</div>`,
    );
    return true;
  } else if (action === 'admin-archive') {
    await api(`/admin/records/${encodeURIComponent(id)}/archive`, { method: 'POST', body: {} });
    toast('Registro arquivado. Você pode revisá-lo e republicá-lo.');
  } else if (action === 'review-submission')
    await api(`/admin/submissions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: { status: el.dataset.status },
    });
  else if (action === 'resolve-privacy')
    await api(`/admin/privacy-requests/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: {},
    });
  else if (action === 'quality-export') {
    download(
      'qualidade-dados.csv',
      csv([['Registro', 'Problema'], ...state.quality.map((q) => [q.title, q.issue])]),
      'text/csv;charset=utf-8',
    );
    return true;
  } else return false;
  await ctx.render();
  return true;
}
export async function submitAdmin(type, form, v, ctx) {
  if (type === 'admin-record') {
    const kind = form.dataset.kind;
    const original = state.records.get(form.dataset.id) || {};
    const data = {};
    for (const k of [...baseFields, ...recordFields[kind]]) {
      if (['provenance'].includes(k)) data[k] = original[k] || [];
      else if (['salary', 'hours', 'year', 'lat', 'lng'].includes(k))
        data[k] = v[k] === '' ? null : Number(v[k]);
      else if (['active', 'recruitmentVerified'].includes(k)) data[k] = !!v[k];
      else if (k === 'tags')
        data[k] = v[k]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      else if (k === 'questions')
        data[k] = v[k]
          .split('\n')
          .filter((s) => s.trim())
          .map((line) => {
            const [id, label, ...options] = line.split('|').map((s) => s.trim());
            return { id, label, options };
          });
      else if (k === 'history')
        data[k] = v[k]
          .split('\n')
          .filter((s) => s.trim())
          .map((line) => {
            const [date, description, sourceUrl] = line.split('|').map((s) => s.trim());
            return { date, description, sourceUrl };
          });
      else data[k] = v[k] ?? '';
    }
    await api(
      `/admin/records/${kind}${form.dataset.id ? '/' + encodeURIComponent(form.dataset.id) : ''}`,
      { method: form.dataset.id ? 'PUT' : 'POST', body: data },
    );
    state.adminEdit = null;
    await ctx.render();
    toast('Rascunho salvo. Revise antes de publicar.');
    return true;
  }
  if (type === 'admin-publish') {
    if (!v.attestation)
      throw new Error('A publicação exige conferência e validação humana explícitas.');
    await api(`/admin/records/${encodeURIComponent(form.dataset.id)}/publish`, {
      method: 'POST',
      body: { attestation: true },
    });
    document.querySelector('#dialog').close();
    await ctx.render();
    toast('Publicação validada e alertas gerados.');
    return true;
  }
  if (type === 'admin-import') {
    const file = form.elements.file.files[0];
    if (!file || file.size > 8 * 1024 * 1024)
      throw new Error(
        'Selecione um CSV de até 8 MB. Para bases grandes, use a rotina de importação.',
      );
    const content = new TextDecoder(v.encoding).decode(await file.arrayBuffer());
    const result = await api('/admin/imports', {
      method: 'POST',
      body: {
        kind: v.kind,
        format: v.format,
        delimiter: v.delimiter,
        sourceDate: v.sourceDate,
        csv: content,
      },
    });
    await ctx.render();
    dialog(
      'Resultado da importação',
      `<p class="muted">${result.created} registros criados; ${result.updated} atualizados; ${result.skipped} ignorados. Os registros aguardam revisão humana.</p><pre>${h(JSON.stringify(result, null, 2))}</pre>`,
    );
    return true;
  }
  return false;
}
