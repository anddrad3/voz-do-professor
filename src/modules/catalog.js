import { api, loadRecords, state } from '../api.js';
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
} from '../ui.js';
export const TYPES = [
  'Notícia',
  'Legislação',
  'Piso salarial',
  'Plano de carreira',
  'Conselho de educação',
];
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
    ['content', 'school', 'opportunity', 'survey'].map((kind) => loadRecords(kind, { q: query })),
  );
  const items = groups.flat();
  return (
    heading(
      'Busca na plataforma',
      `Resultados para “${query}”`,
      `${items.length} resultados em publicações, escolas, oportunidades e pesquisas.`,
    ) +
    `<form data-form="global-search" class="filters"><div class="row">${field('q', 'Palavra-chave', query, 'search', 'required')}<button class="button primary">Pesquisar</button></div></form><div class="masonry">${items.length ? items.map((r) => card(r, state)).join('') : empty()}</div>`
  );
}
function filters(kind, all) {
  const f = state.filters[kind] || {};
  return `<form class="filters" data-form="filter" data-kind="${kind}"><div class="form-grid">${field('q', 'Buscar por assunto ou palavra-chave', f.q || '', 'search', 'placeholder="O que você procura?"')}${field('city', 'Município', f.city || '', 'text', 'list="cities" placeholder="Todo o Brasil"')}${select('state', 'Estado', STATES, f.state)}${
    kind === 'content'
      ? `${select('type', 'Tipo de informação', TYPES, f.type)}${select('level', 'Nível de ensino', LEVELS, f.level)}`
      : kind === 'school'
        ? `${select('network', 'Rede de ensino', ['Municipal', 'Estadual', 'Federal', 'Privada', 'Não informada'], f.network)}${select(
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
          )}`
        : `${select('type', 'Tipo de oportunidade', OPPORTUNITY_TYPES, f.type)}${select('discipline', 'Disciplina', uniq(all, 'discipline'), f.discipline)}${select('level', 'Nível de ensino', LEVELS, f.level)}${select('education', 'Escolaridade exigida', uniq(all, 'education'), f.education)}${select('status', 'Situação', ['Futuro', 'Inscrições abertas', 'Encerrado', 'Em andamento', 'Suspenso', 'Finalizado'], f.status)}${select(
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
          )}`
  }${kind !== 'content' ? `${field('lat', 'Latitude de referência', f.lat ?? state.user?.profile?.lat ?? '', 'number', 'step="any" min="-90" max="90"')}${field('lng', 'Longitude de referência', f.lng ?? state.user?.profile?.lng ?? '', 'number', 'step="any" min="-180" max="180"')}` : ''}</div><datalist id="cities">${uniq(
    all,
    'city',
  )
    .map((c) => `<option value="${h(c)}"></option>`)
    .join(
      '',
    )}</datalist><div class="form-actions"><button class="button primary">${icon('sliders-horizontal')}Aplicar filtros</button><button type="button" class="button" data-action="clear-filters" data-kind="${kind}">Limpar</button>${kind !== 'content' ? `<button type="button" class="button" data-action="geolocate">${icon('locate-fixed')}Usar minha localização</button><button type="button" class="button" data-action="city-center">${icon('map-pin')}Usar centro das escolas da cidade</button>` : ''}</div></form>`;
}
export async function home() {
  const [posts, schools, opportunities, surveys] = await Promise.all(
    ['content', 'school', 'opportunity', 'survey'].map((k) => loadRecords(k)),
  );
  return (
    heading(
      'Sua voz tem lugar aqui',
      'Informação que fortalece.',
      'Direitos, oportunidades e experiências que conectam e valorizam quem ensina.',
      `<a class="button" href="#/voz">${icon('messages-square')}Compartilhe sua experiência</a>`,
    ) +
    `<div class="toolbar"><a class="chip active" href="#/inicio">Recentes</a>${TYPES.map((t) => `<button class="chip" data-action="content-category" data-value="${h(t)}">${h(t)}</button>`).join('')}<span class="spacer"></span><a class="button small ghost" href="#/direitos">${icon('sliders-horizontal')}Filtrar</a></div><div class="masonry">${posts.map((p) => card(p, state)).join('')}<article class="card accent-block"><div class="meta"><span class="source-icon">${icon('compass')}</span>Um espaço para a sua trajetória</div><h3>Conecte seus próximos passos.</h3><p>Encontre instituições, acompanhe seleções e participe da construção de uma educação com mais escuta.</p><div class="mini-grid" style="margin-top:20px"><a class="home-link" href="#/radar">${icon('map-pinned')}Radar de Escolas<span>${schools.length} instituições na base</span></a><a class="home-link" href="#/oportunidades">${icon('briefcase-business')}Oportunidades<span>${opportunities.length} editais publicados</span></a><a class="home-link" href="#/voz">${icon('messages-square')}Sua voz importa<span>${surveys.length} pesquisas disponíveis</span></a><a class="home-link" href="#/perfil">${icon('bookmark')}Seu espaço<span>Perfil, alertas e favoritos</span></a></div></article>${surveys
      .slice(0, 1)
      .map((r) => card(r, state))
      .join('')}</div>`
  );
}
export async function catalog(kind) {
  const all = await loadRecords(kind);
  const filtered = Object.values(state.filters[kind] || {}).some((v) => v !== '' && v != null)
    ? await loadRecords(kind, state.filters[kind])
    : all;
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
  };
  let out = heading(
    ...titles[kind],
    kind === 'opportunity'
      ? `<button class="button" data-action="calendar-toggle">${icon('calendar-days')}${state.showCalendar ? 'Ver cards' : 'Calendário'}</button>`
      : '',
  );
  out += filters(kind, all);
  if (kind === 'school') {
    const grouped = {};
    for (const s of filtered)
      grouped[`${s.city} / ${s.state}`] = (grouped[`${s.city} / ${s.state}`] || 0) + 1;
    out +=
      notice(
        'Uma instituição no mapa não significa uma vaga aberta. As bases podem ter defasagens. Confira a fonte e a data de cada registro.',
      ) +
      `<div class="territory-bars">${Object.entries(grouped)
        .map(
          ([city, count]) =>
            `<span class="tag">${h(city)} · ${count} ${count === 1 ? 'instituição' : 'instituições'}</span>`,
        )
        .join(
          '',
        )}</div><div id="school-map" class="map map-placeholder">${icon('map-pinned')}<p class="small-text muted">Explore ${filtered.filter((s) => s.lat != null && s.lng != null).length} instituições com coordenadas.<br>O mapa utiliza imagens do OpenStreetMap, que recebe a conexão ao carregá-las.</p><button class="button" data-action="load-map">Abrir mapa interativo</button></div>`;
  }
  if (kind === 'opportunity' && state.showCalendar) out += calendar(filtered);
  out += `<div class="section-title"><span class="small-text muted">${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}</span>${kind === 'opportunity' ? '<button class="button small" data-action="export-calendar">Exportar calendário (.ics)</button>' : ''}</div><div class="masonry">${filtered.length ? filtered.map((r) => card(r, state)).join('') : empty()}</div>`;
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
  const r = await api(`/record/${encodeURIComponent(id)}`);
  state.records.set(r.id, r);
  if (r.kind === 'survey') return null;
  const back = { content: 'direitos', school: 'radar', opportunity: 'oportunidades' }[r.kind];
  let details = '';
  const dl = (pairs) =>
    `<dl class="detail-list">${pairs.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl>`;
  if (r.kind === 'content') {
    details += r.summary
      ? `<div class="card accent-block"><h3>Em linguagem simples</h3><p>${h(r.summary)}</p></div>`
      : '';
    if (r.type === 'Piso salarial')
      details += dl([
        ['Valor', money(r.salary)],
        ['Ano de referência', r.year || 'Aguardando curadoria'],
        ['Jornada de referência', r.hours ? `${r.hours}h semanais` : 'Não informada'],
      ]);
    details += `<h3>Mudanças na norma</h3>${r.history?.length ? `<div class="timeline">${r.history.map((i) => `<div><small>${fmtDate(i.date)}</small><p>${h(i.description)}</p>${external(i.sourceUrl, 'Fonte da alteração')}</div>`).join('')}</div>` : '<p>Nenhuma alteração cadastrada pelo responsável.</p>'}`;
  }
  if (r.kind === 'school')
    details +=
      dl([
        ['Município', `${r.city} / ${r.state}`],
        ['Rede', r.network],
        ['Endereço', r.address || 'Não informado'],
        ['Contato público', r.phone || 'Não informado'],
        ['CNPJ', r.cnpj || 'Não informado'],
        ['Código Inep', r.inepCode || 'Não informado'],
        ['CNAE', r.cnae || 'Não informado'],
        ['Cruzamento das bases', r.crosscheck],
      ]) +
      `<div class="row">${external(r.website, 'Site da instituição')}${r.recruitmentVerified ? external(r.recruitmentUrl, 'Canal de candidatura verificado') : ''}</div>` +
      notice(
        'A presença no radar não comprova a existência de vagas. Canais de candidatura só aparecem após verificação.',
      ) +
      (r.provenance?.length
        ? `<h3>Origem dos dados</h3><div class="timeline">${r.provenance.map((p) => `<div><small>${fmtDate(p.date)}</small><p>${h(p.source)}</p>${external(p.url, 'Conferir base')}</div>`).join('')}</div>`
        : '');
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
      `<h3>Requisitos</h3><p>${h(r.requirements)}</p><h3 style="margin-top:20px">Documentação</h3><p>${h(r.documents || 'Confira a documentação no edital.')}</p><div class="form-actions">${external(r.sourceUrl, 'Edital oficial')}${external(r.registrationUrl, 'Página de inscrição')}<button class="button" data-action="export-calendar" data-id="${h(r.id)}">${icon('calendar-plus')}Salvar prazos</button></div>`;
  const revisions = await api(`/history/${encodeURIComponent(id)}`);
  return `<div class="reading"><a class="button ghost small" href="#/${back}" style="margin-bottom:24px">${icon('arrow-left')}Voltar</a><article class="card"><div class="meta">${demo(r)}<span class="tag">${h(r.type || r.network)}</span><span>${h(r.city ? `${r.city} / ${r.state}` : 'Nacional')}</span></div><h1>${h(r.title)}</h1><p class="body">${h(r.body)}</p><div class="form-actions"><button class="button" data-action="favorite" data-id="${h(r.id)}" aria-pressed="${state.favorites.has(r.id)}">${icon('bookmark')}${state.favorites.has(r.id) ? 'Salvo' : 'Salvar'}</button><button class="button" data-action="audio" data-id="${h(r.id)}">${icon('play')}Ouvir</button><button class="button" data-action="citation" data-id="${h(r.id)}">${icon('copy')}Citar</button></div></article><div class="card">${details}</div><div class="card"><h3>Fonte e responsabilidade editorial</h3><p>${h(r.sourceName || 'Fonte não informada')}</p><p>Conferência da fonte: ${fmtDate(r.sourceDate)}<br>Curadoria: ${h(r.reviewer || 'Demonstração — sem validação humana')}</p><div class="form-actions">${external(r.sourceUrl, 'Conferir fonte original')}</div><details><summary>Histórico de revisões</summary>${revisions.length ? revisions.map((v) => `<div class="timeline"><small>${fmtDate(v.date)} · ${h(v.reviewer)}</small><p>${h(v.summary || v.title)}</p>${external(v.sourceUrl, 'Fonte desta revisão')}</div>`).join('') : '<p class="small-text muted">Sem revisões publicadas.</p>'}</details></div></div>`;
}
export async function loadMap() {
  const container = document.querySelector('#school-map');
  if (!container) return;
  const L = await import('leaflet');
  container.innerHTML = '';
  container.classList.remove('map-placeholder');
  const map = L.map(container).setView([-15.78, -47.92], 4);
  state.map = map;
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  let reported = false;
  tiles.on('tileerror', () => {
    if (!reported) {
      toast(
        'Não foi possível carregar imagens do mapa. A lista de instituições continua disponível.',
      );
      reported = true;
    }
  });
  tiles.addTo(map);
  const points = [];
  for (const s of state.currentItems || []) {
    if (s.lat == null || s.lng == null) continue;
    points.push([s.lat, s.lng]);
    L.circleMarker([s.lat, s.lng], {
      radius: 8,
      color: '#ef4444',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 0.45,
    })
      .addTo(map)
      .bindPopup(
        `<strong>${h(s.title)}</strong><br>${h(s.address)}<br><a href="${detailUrl(s)}">Ver instituição</a>`,
      );
  }
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
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
