import { api, loadRecords, state, enabled, locationFilters } from '../api.js';
import { assistantPanel } from './assistant.js';
import {
  h,
  icon,
  heading,
  card,
  empty,
  field,
  select,
  notice,
  fmtDate,
  money,
  external,
  demo,
  download,
  toast,
  detailUrl,
  viewControls,
  publicationAge,
  recordImage,
  categoryLabel,
} from '../ui.js';
export const TYPES = ['Notícia', 'Legislação', 'Piso salarial', 'Plano de carreira'];
export const LEVELS = [
  'Educação Infantil',
  'Ensino Fundamental',
  'Ensino Médio',
  'Ensino Superior',
  'Todos',
];
export const STATES =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const OPPORTUNITY_TYPES = [
  'Concurso público',
  'Processo simplificado',
  'Seleção privada',
  'Cadastro de reserva',
];
const uniq = (items, key) => [...new Set(items.map((i) => i[key]).filter(Boolean))].sort();
export async function globalSearch(query) {
  const groups = await Promise.all(
    ['content', 'school', 'opportunity', 'survey', 'story'].map((kind) =>
      loadRecords(kind, { q: query }),
    ),
  );
  const items = groups.flat();
  return (
    heading(
      'Busca na plataforma',
      `Resultados para “${query}”`,
      `${items.length} resultados em publicações, oportunidades e pesquisas.`,
    ) +
    assistantPanel('search', query) +
    `<form data-form="global-search" class="filters"><div class="row">${field('q', 'Palavra-chave', query, 'search', 'required')}<button class="button primary">Pesquisar</button></div></form>${viewControls(state)}<div class="masonry">${items.length ? items.map((r) => card(r, state)).join('') : empty()}</div>`
  );
}
const countryNames = {
  BR: 'Brasil',
  GB: 'Reino Unido',
  US: 'Estados Unidos',
  PT: 'Portugal',
  CA: 'Canadá',
  AU: 'Austrália',
  IN: 'Índia',
  FR: 'França',
  DE: 'Alemanha',
  ES: 'Espanha',
  ZZ: 'Não identificado',
  GLOBAL: 'Internacional / remoto',
};
function filters(kind, all) {
  const f = locationFilters(kind);
  const countries = uniq(all, 'country');
  if (!countries.includes('BR')) countries.push('BR');
  const cities = uniq(
    all.filter((r) => (!f.country || r.country === f.country) && (!f.state || r.state === f.state)),
    'city',
  );
  return `<form class="filters" data-form="filter" data-kind="${kind}"><div class="form-grid">${field('q', 'Buscar por assunto ou palavra-chave', f.q || '', 'search')}${select(
    'country',
    'País da fonte / instituição',
    countries.map((c) => [c, countryNames[c] || c]),
    f.country,
  )}${select('state', 'Estado no Brasil', STATES, f.state)}${field('city', 'Cidade citada / município', f.city || '', 'text', 'list="cities"')}${kind === 'content' ? `${select('type', 'Tipo de informação', TYPES, f.type)}${select('level', 'Nível de ensino', LEVELS, f.level)}${select('scope', 'Abrangência da legislação', ['Nacional', 'Estadual', 'Distrital'], f.scope)}` : kind === 'school' ? `${select('network', 'Rede de ensino', ['Municipal', 'Estadual', 'Federal', 'Privada', 'Não informada'], f.network)}${field('cnae', 'CNAE (código ou prefixo)', f.cnae || '', 'text', 'placeholder="85"')}` : `${select('type', 'Tipo de oportunidade', OPPORTUNITY_TYPES, f.type)}${select('discipline', 'Disciplina', uniq(all, 'discipline'), f.discipline)}${select('education', 'Escolaridade exigida', uniq(all, 'education'), f.education)}${select('level', 'Nível de ensino', LEVELS, f.level)}${select('status', 'Situação', ['Futuro', 'Inscrições abertas', 'Encerrado', 'Em andamento', 'Suspenso', 'Finalizado', 'Consultar na fonte'], f.status)}${field('salaryMin', 'Salário mínimo informado (R$)', f.salaryMin || '', 'number', 'min="0"')}`}${
    kind !== 'content'
      ? `${select(
          'radius',
          'Distância máxima',
          [
            [0, 'Sem limite'],
            [5, '5 km'],
            [10, '10 km'],
            [25, '25 km'],
            [50, '50 km'],
          ],
          f.radius || 0,
          false,
        )}${field('lat', 'Latitude (somente local)', f.lat ?? state.profile.lat ?? '', 'number', 'step="any" min="-90" max="90"')}${field('lng', 'Longitude (somente local)', f.lng ?? state.profile.lng ?? '', 'number', 'step="any" min="-180" max="180"')}`
      : ''
  }</div><datalist id="cities">${cities.map((c) => `<option value="${h(c)}"></option>`).join('')}</datalist><p class="filter-note">${kind === 'content' ? 'País identifica a origem da fonte. Estado/cidade indicam local citado no título, quando reconhecido sem ambiguidade; ausência de classificação não significa ausência de notícias.' : 'Localização e filtros ficam neste navegador. A fonte de instituições está em preparação.'} Filtros são processados neste navegador.</p><div class="form-actions"><button class="button primary">Aplicar filtros</button><button type="button" class="button" data-action="clear-filters" data-kind="${kind}">Limpar</button>${kind !== 'content' ? `<button type="button" class="button" data-action="geolocate">${icon('locate-fixed')}Usar minha localização</button>` : ''}</div></form>`;
}
export async function home() {
  const [posts, schools, opportunities, stories] = await Promise.all(
    ['content', 'school', 'opportunity', 'story'].map((k) => loadRecords(k)),
  );
  const links = [
    ['school', 'radar', 'Radar de Escolas', 'Nova base em preparação', 'map-pinned'],
    [
      'opportunity',
      'oportunidades',
      'Oportunidades',
      'Busca guiada com fontes',
      'briefcase-business',
    ],
    ['voice', 'voz', 'Sua voz importa', 'PDF e relatos publicados', 'messages-square'],
    [
      'preferences',
      'perfil',
      'Minha Sala de Aula',
      'Preferências e favoritos locais',
      'chalkboard-user',
    ],
  ].filter(([feature]) => enabled(feature));
  return (
    heading(
      'Sua voz tem lugar aqui',
      'Informação que fortalece.',
      'Informação, autonomia e valorização docente: direitos, oportunidades e escuta para apoiar quem ensina.',
      enabled('voice')
        ? `<a class="button" href="#/voz">${icon('messages-square')}Compartilhe sua experiência</a>`
        : '',
    ) +
    (enabled('content')
      ? `<div class="toolbar"><a class="chip active" href="#/inicio">Recentes</a>${TYPES.map((t) => `<button class="chip" data-action="content-category" data-value="${h(t)}">${h(t)}</button>`).join('')}<span class="spacer"></span><a class="button small ghost" href="#/direitos">${icon('sliders-horizontal')}Filtrar</a></div>`
      : '') +
    `<article class="card"><div class="meta">Pesquisa e interesse público</div><h2>Uma plataforma a partir das necessidades do professor</h2><p>O Voz do Professor reúne informação profissional, direitos, oportunidades e experiências docentes para fortalecer a autonomia e a autoria pedagógica. A IA ajuda a organizar informações com fontes; as decisões sobre ensinar continuam com o professor.</p><p>Idealização e desenvolvimento: <strong>Matheus da Silva Andrade</strong>, mestrando em Planejamento e Análise de Políticas Públicas na Unesp/Franca, sob orientação do <strong>Prof. Dr. Genaro Alvarenga Fonseca</strong>.</p><a class="button small" href="#/transparencia">Conheça o projeto e sua metodologia</a></article>` +
    `${viewControls(state)}<div class="masonry">${posts
      .slice(0, 36)
      .map((p) => card(p, state))
      .join(
        '',
      )}${links.length ? `<article class="card accent-block"><div class="meta">Um espaço para a sua trajetória</div><h3>Conecte seus próximos passos.</h3><p>Informação com fonte, sem criar conta.</p><div class="mini-grid">${links.map(([, route, label, description, ico]) => `<a class="home-link" href="#/${route}">${icon(ico)}${label}<span>${h(description)}</span></a>`).join('')}</div></article>` : ''}${stories
      .slice(0, 3)
      .map((r) => card(r, state))
      .join('')}</div>`
  );
}
export function radar() {
  return (
    heading(
      'Conexões no território',
      'Radar de Escolas',
      'Prepare os filtros e escolha sua localização.',
    ) +
    filters('school', []) +
    notice(
      'A busca de instituições está em reformulação. Os filtros e a localização continuam disponíveis; nenhuma consulta de CNPJ ou base antiga é executada.',
    ) +
    empty(
      'Nova fonte de dados em preparação',
      'Nenhuma instituição é exibida até a nova integração ser ativada.',
    )
  );
}
export async function catalog(kind) {
  const all = await loadRecords(kind);
  const { network, ...catalogFilters } = locationFilters(kind);
  if (catalogFilters.level === 'Todos') catalogFilters.level = '';
  const filtered = await loadRecords(kind, catalogFilters);
  state.currentItems = filtered;
  const titles = {
    content: [
      'Conhecimento e autonomia',
      'Direitos e Notícias',
      'Fontes, explicações e contexto para acompanhar a profissão.',
    ],
    school: [
      'Conexões no território',
      'Radar de Escolas',
      'Encontre instituições de ensino na sua região e conheça seus canais oficiais.',
    ],
    opportunity: [
      'Novos caminhos',
      'Oportunidades',
      'Concursos, seleções e cadastros de reserva para a sua trajetória.',
    ],
    contests: [
      'Seleções na educação',
      'Concursos públicos',
      'Comunicados de fontes oficiais. Confirme prazos e inscrições no edital; a cobertura do catálogo é parcial.',
    ],
  };
  let out = heading(
    ...titles[kind],
    kind === 'opportunity' && enabled('calendar')
      ? `<button class="button" data-action="calendar-toggle">${icon('calendar-days')}${state.showCalendar ? 'Ver cards' : 'Calendário'}</button>`
      : '',
  );
  if (kind === 'content')
    out += `<div class="toolbar"><button class="chip ${!state.filters.content?.type ? 'active' : ''}" data-action="content-category" data-value="">Recentes</button>${TYPES.map((t) => `<button class="chip ${state.filters.content?.type === t ? 'active' : ''}" data-action="content-category" data-value="${h(t)}">${h(t)}</button>`).join('')}</div>`;
  if (kind === 'content' || kind === 'contests') {
    const type = state.filters.content?.type;
    const topic =
      kind === 'contests'
        ? 'contests'
        : type === 'Piso salarial'
          ? 'salary'
          : !type || type === 'Notícia'
            ? 'news'
            : 'law';
    out += assistantPanel(topic, '', { kind });
    if (topic === 'salary') return out;
  } else out += filters(kind, all);
  if (kind === 'opportunity' && enabled('calendar') && state.showCalendar)
    out += calendar(filtered);
  out += `<div class="section-title"><span class="small-text muted">${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}</span>${kind === 'opportunity' && enabled('calendar') ? '<button class="button small" data-action="export-calendar">Exportar calendário (.ics)</button>' : ''}</div>${viewControls(state)}<div class="masonry">${filtered.length ? filtered.map((r) => card(r, state)).join('') : empty()}</div>`;
  return out;
}
function calendar(items) {
  const today = new Date(),
    month = new Date(today.getFullYear(), today.getMonth() + state.calendarOffset, 1);
  const first = month.getDay(),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  let cells = Array.from({ length: first }, () => '<div class="day"></div>');
  for (let d = 1; d <= days; d++) {
    const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const events = items.flatMap((r) =>
      [
        ['opens', 'Abertura'],
        ['closes', 'Encerramento'],
        ['examDate', 'Prova'],
      ]
        .filter(([key]) => r[key] === date)
        .map(([, name]) => ({ r, name })),
    );
    cells.push(
      `<div class="day"><span>${d}</span>${events.map(({ r, name }) => `<a class="event" href="${detailUrl(r)}">${h(name)}: ${h(r.title)}</a>`).join('')}</div>`,
    );
  }
  return `<div class="section-title"><button class="icon-button" data-action="month-prev" aria-label="Mês anterior">${icon('chevron-left')}</button><h2>${h(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2><button class="icon-button" data-action="month-next" aria-label="Próximo mês">${icon('chevron-right')}</button></div><div class="calendar">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => `<div class="weekday">${day}</div>`).join('')}${cells.join('')}</div>`;
}
export async function detail(id) {
  let r,
    localCopy = false;
  try {
    r = await api(`/record/${encodeURIComponent(id)}`);
  } catch (error) {
    r = state.savedRecords.find((r) => r.id === id && r.kind !== 'story');
    if (!r || !enabled(r.kind === 'opportunity' ? 'contests' : r.kind)) throw error;
    localCopy = true;
  }
  state.records.set(r.id, r);
  if (r.kind === 'survey') return null;
  const back = { content: 'direitos', school: 'radar', opportunity: 'oportunidades', story: 'voz' }[
    r.kind
  ];
  let details = '';
  const dl = (pairs) =>
    `<dl class="detail-list">${pairs.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl>`;
  if (r.kind === 'content') {
    details +=
      r.summary && !r.aiGenerated
        ? `<div class="card accent-block"><h3>Em linguagem simples</h3><p>${h(r.summary)}</p></div>`
        : '';
    if (r.type === 'Piso salarial')
      details += dl([
        ['Valor', money(r.salary)],
        ['Ano de referência', r.year || 'Aguardando curadoria'],
        ['Jornada de referência', r.hours ? `${r.hours}h semanais` : 'Não informada'],
      ]);
    if (r.type !== 'Notícia')
      details += `<h3>Mudanças na norma</h3>${r.history?.length ? `<div class="timeline">${r.history.map((i) => `<div><small>${fmtDate(i.date)}</small><p>${h(i.description)}</p>${external(i.sourceUrl, 'Fonte da alteração')}</div>`).join('')}</div>` : '<p>Consulte o texto atualizado e a situação da norma na fonte oficial. A ausência de mudanças aqui não comprova vigência.</p>'}`;
  }
  if (r.kind === 'story')
    details += `<h3>${r.anonymous ? 'Relato publicado anonimamente' : h(r.author || 'Autor não informado')}</h3><p>Referência para remoção/correção: ${h(r.id)}. Baixe o formulário na área Voz do Professor e envie por e-mail.</p><a class="button" href="#/voz">Formulário de remoção ou correção</a>`;
  if (r.kind === 'opportunity')
    details +=
      dl([
        ['Modalidade', r.type],
        ['Disciplina', r.discipline],
        ['Município', `${r.city} / ${r.state}`],
        ['Nível de ensino', r.level],
        ['Escolaridade', r.education],
        ['Remuneração', money(r.salary)],
        ['Jornada', r.hours ? `${r.hours}h semanais` : 'Não informada'],
        ['Inscrições', `${fmtDate(r.opens)} a ${fmtDate(r.closes)}`],
        ['Data de prova', fmtDate(r.examDate)],
        ['Situação', r.situation || r.stage],
      ]) +
      `<h3>Requisitos</h3><p>${h(r.requirements)}</p><h3 style="margin-top:20px">Documentação</h3><p>${h(r.documents || 'Confira a documentação no edital.')}</p><div class="form-actions">${external(r.sourceUrl, 'Edital oficial')}${external(r.registrationUrl, 'Página de inscrição')}${enabled('calendar') ? `<button class="button" data-action="export-calendar" data-id="${h(r.id)}">${icon('calendar-plus')}Salvar prazos</button>` : ''}</div>`;
  const revisions = localCopy ? [] : await api(`/history/${encodeURIComponent(id)}`);
  return `${localCopy ? notice('Cópia salva neste navegador. A publicação não está disponível no catálogo atual; confirme datas, vigência e condições na fonte original.') : ''}<div class="detail-board"><a class="button ghost small" href="#/${back}" data-action="back" style="margin-bottom:24px">${icon('arrow-left')}Voltar</a><div class="publication-thread"><article class="card"><div class="meta">${demo(r)}<span class="tag">${h(categoryLabel(r))}</span><span>${h(r.city ? `${r.city} / ${r.state}` : countryNames[r.country] || 'Localidade não informada')}</span></div><h1>${h(r.title)}</h1>${publicationAge(r)}${recordImage(r)}${r.excerpt ? `<blockquote class="excerpt"><p>${h(r.excerpt)}</p><cite>${h(r.excerptCredit)}</cite></blockquote>` : ''}<p class="body">${h(r.body)}</p><div class="form-actions">${enabled('favorites') ? `<button class="button" data-action="favorite" data-id="${h(r.id)}" aria-pressed="${state.favorites.has(r.id)}">${icon('bookmark')}${state.favorites.has(r.id) ? 'Salvo' : 'Salvar'}</button>` : ''}${enabled('audio') ? `<button class="button" data-action="audio" data-id="${h(r.id)}">${icon('play')}Ouvir</button>` : ''}<button class="button" data-action="citation" data-id="${h(r.id)}">${icon('copy')}Citar</button></div></article>${details ? `<div class="card thread-reply">${details}</div>` : ''}<div class="card thread-reply"><h3>Fonte e responsabilidade editorial</h3><p>${h(r.sourceName || 'Fonte não informada')}</p><p>Data da fonte: ${fmtDate(r.sourceDate)}${r.checkedAt ? `<br>Última consulta automática: ${fmtDate(r.checkedAt)}` : ''}<br>${h(r.automatic ? r.attribution : r.reviewer || 'Demonstração — sem validação humana')}<br>${h(r.locationBasis || '')}</p><div class="form-actions">${external(r.sourceUrl, 'Conferir fonte original')}</div><details><summary>Histórico de revisões</summary>${revisions.length ? revisions.map((v) => `<div class="timeline"><small>${fmtDate(v.date)} · ${h(v.reviewer)}</small><p>${h(v.summary || v.title)}</p>${external(v.sourceUrl, 'Fonte desta revisão')}</div>`).join('') : '<p class="small-text muted">Sem revisões publicadas.</p>'}</details></div></div></div>`;
}
export function exportCalendar(items) {
  const esc = (s) =>
    String(s || '')
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');
  const events = items.flatMap((r) =>
    [
      ['opens', 'Abertura das inscrições'],
      ['closes', 'Encerramento das inscrições'],
      ['examDate', 'Prova'],
    ]
      .filter(([key]) => r[key])
      .map(([key, label]) => {
        const end = new Date(r[key] + 'T12:00:00Z');
        end.setUTCDate(end.getUTCDate() + 1);
        return [
          'BEGIN:VEVENT',
          `UID:${r.id}-${key}@voz-do-professor`,
          `DTSTAMP:${new Date()
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '')}`,
          `DTSTART;VALUE=DATE:${r[key].replaceAll('-', '')}`,
          `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
          `SUMMARY:${esc(label + ' · ' + r.title)}`,
          `DESCRIPTION:${esc((r.demo ? 'DEMONSTRAÇÃO. ' : '') + r.sourceUrl)}`,
          'END:VEVENT',
        ].join('\r\n');
      }),
  );
  download(
    'voz-do-professor-prazos.ics',
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Voz do Professor//Prazos//PT-BR',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n'),
    'text/calendar;charset=utf-8',
  );
}
