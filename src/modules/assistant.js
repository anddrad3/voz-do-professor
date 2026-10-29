import { TERMS_VERSION } from '../../shared/terms.js';
import { greeting } from './personalization.js';
import { state, saveLocal, enabled, locationFilters } from '../api.js';
import { formatAiText } from '../../shared/ai-text.js';
import { h, heading, field, select, icon, toast, refreshIcons, empty, external } from '../ui.js';
import {
  AI_TOPICS,
  AI_ROLES,
  AI_LEVELS,
  AI_NETWORKS,
  AI_ACTIONS,
  BRAZIL_STATES,
  actionsForTopic,
} from '../../shared/assistant.js';
let current = null;
const recentAnswers = new Map();
export function attachSuggestions(root, html) {
  if (!html || html.length > 50000) return;
  const frame = document.createElement('iframe');
  frame.title = 'Sugestões de pesquisa do Google';
  frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
  frame.referrerPolicy = 'no-referrer';
  frame.className = 'google-suggestions';
  frame.style.colorScheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  frame.srcdoc = `<meta name="color-scheme" content="${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}"><style>html,body{margin:0;background:transparent;color-scheme:${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}}</style><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://www.google.com https://www.gstatic.com data:; base-uri 'none'"><base target="_blank">${html}`;
  root.querySelector('.ai-suggestions')?.append(frame);
}
export function hydrateSavedChats(root) {
  root.querySelectorAll('[data-saved-chat]').forEach((el) => {
    const c = state.chats.find((c) => c.id === el.dataset.savedChat);
    attachSuggestions(el, c?.searchSuggestions);
  });
}
const allowed = (topic) =>
  enabled(
    {
      jobs: 'opportunity',
      news: 'content',
      law: 'content',
      salary: 'content',
      contests: 'contests',
      search: 'search',
    }[topic],
  );
export function assistantPanel(topic = 'jobs', query = '', options = {}) {
  if (!allowed(topic)) return '';
  const kind = options.kind;
  const p = locationFilters(kind || topic);
  const catalogFields = kind
    ? `${field('q', 'Buscar no catálogo', p.q || '', 'search')}${select(
        'country',
        'País',
        [
          ['BR', 'Brasil'],
          ['GB', 'Reino Unido'],
          ['US', 'Estados Unidos'],
          ['PT', 'Portugal'],
          ['GLOBAL', 'Internacional / remoto'],
        ],
        p.country,
      )}`
    : '';
  const localButton =
    kind && topic !== 'salary'
      ? '<button class="button" name="action" value="catalog" formnovalidate>Filtrar publicações do site</button>'
      : '';
  return `<section class="card assistant"><div class="meta">${icon('messages-square')} Consulta com fontes</div><h2>${h(AI_TOPICS[topic])}</h2><p>Escolha os filtros e uma pergunta. A busca só acontece quando você enviar; a disponibilidade depende do limite de consultas compartilhado.</p><form data-form="assistant" data-kind="${h(kind || topic)}" class="stack"><input type="hidden" name="topic" value="${h(topic)}"><div class="form-grid">${catalogFields}${select('state', 'Estado', BRAZIL_STATES, p.state)}${field('city', 'Cidade (opcional)', p.city || '', 'text', 'maxlength="80"')}${select('role', 'Cargo', AI_ROLES, 'Professor', false)}${select('level', 'Nível de ensino', AI_LEVELS, p.level || 'Todos', false)}${select('network', 'Rede', AI_NETWORKS, p.network || (topic === 'jobs' ? 'Privada' : 'Todas'), false)}${topic === 'search' ? field('query', 'Assunto de educação', query, 'search', 'required maxlength="120"') : ''}</div><div class="form-actions"><button type="button" class="button" data-action="geolocate">${icon('locate-fixed')}Usar minha localização</button>${localButton}<button type="button" class="button" data-action="clear-filters" data-kind="${h(kind || topic)}">Limpar filtros</button></div><p class="muted small-text">Sua região vem da Minha Sala de Aula. Você pode mudar os filtros nesta consulta. A IA só é acionada pelos botões de pergunta abaixo.</p><label class="ai-consent"><input type="checkbox" name="eligible" required> Tenho 18 anos ou mais, sou profissional da educação e estou no Brasil. Li e aceito os <a href="#/termos" target="_blank" rel="noopener">Termos e Condições</a>.</label><label class="ai-consent"><input type="checkbox" name="consent" required> Autorizo enviar estes filtros ao Google para esta consulta. Não informe dados pessoais.</label><label class="ai-consent"><input type="checkbox" name="statisticsConsent" required> Concordo com a contagem agregada por tema, estado e mês quando as estatísticas estiverem habilitadas, sem guardar minha pergunta ou identificação. Esta confirmação é necessária para consultar a IA.</label><div class="form-actions">${Object.entries(
    actionsForTopic(topic),
  )
    .map(
      ([value, label]) =>
        `<button class="button ${value === 'overview' ? 'primary' : ''}" name="action" value="${h(value)}" ${state.config.ai?.interactive === true && enabled('ai') ? '' : 'disabled title="Consultas temporariamente indisponíveis"'}>${h(label)}</button>`,
    )
    .join('')}</div></form><div class="ai-results stack" aria-live="polite"></div></section>`;
}
export function jobsPage() {
  return (
    heading(
      'Próximos passos',
      'Oportunidades',
      'Vagas privadas, bancos de talentos e canais de candidatura. Concursos têm uma área própria.',
    ) +
    greeting(
      'Escolha os filtros para procurar vagas e canais de candidatura compatíveis com seus interesses. Confirme os requisitos na fonte.',
    ) +
    assistantPanel('jobs')
  );
}
function answerMarkup(answer, saved = false) {
  return `<article class="card ai-answer"><div class="meta">${h(answer.title)} · ${h(new Date(answer.generatedAt).toLocaleString('pt-BR'))}</div><div class="ai-text">${formatAiText(answer.text)}</div><h3>Fontes consultadas</h3><ul>${(answer.sources || []).map((s) => `<li>${external(s.url, s.title)}</li>`).join('')}</ul><p class="muted small-text">Resposta por IA (${h(answer.model)}). Confira informações, prazos e vigência nas fontes originais.</p><div class="ai-suggestions"><p class="muted small-text">Termos utilizados · Google Search</p></div>${saved ? '' : `${enabled('alerts') ? '<button class="button" data-action="save-chat">Salvar na Minha Sala de Aula</button>' : ''}`}</article>`;
}
export function savedChats() {
  state.chats = (state.chats || [])
    .filter((c) => Date.parse(c.generatedAt) > Date.now() - 90 * 86400000)
    .slice(-20);
  return `<h2>Consultas que você salvou</h2><p class="muted">Até 20 consultas por 90 dias, somente neste navegador. Limpar os dados locais apaga o histórico. Nenhum chat é salvo no servidor.</p><div class="masonry">${state.chats.map((c) => `<section data-saved-chat="${h(c.id)}">${answerMarkup(c, true)}<button class="button small" data-action="delete-chat" data-id="${h(c.id)}">Apagar esta consulta</button></section>`).join('') || empty('Nenhuma consulta salva', 'Após uma resposta da IA, use Salvar na Minha Sala de Aula.')}</div>`;
}
export async function submitAssistant(form, submitter) {
  if (form.dataset.busy) return;
  const raw = Object.fromEntries(new FormData(form));
  if (raw.country && raw.country !== 'BR')
    throw new Error(
      'As consultas de IA atendem regiões do Brasil. Para fontes internacionais, use o filtro do catálogo.',
    );
  state.filters[form.dataset.kind] = {
    ...locationFilters(form.dataset.kind),
    ...Object.fromEntries(
      Object.entries(raw).filter(([k]) =>
        ['country', 'state', 'city', 'level', 'network', 'q'].includes(k),
      ),
    ),
  };
  const values = Object.fromEntries(
    Object.entries(raw).filter(([k]) =>
      [
        'topic',
        'state',
        'city',
        'role',
        'level',
        'network',
        'query',
        'consent',
        'eligible',
        'statisticsConsent',
      ].includes(k),
    ),
  );
  // Repeat an identical question locally for six hours without charging a new API call.
  const fingerprint = JSON.stringify(
    Object.fromEntries(
      Object.entries({
        ...values,
        consent: undefined,
        eligible: undefined,
        statisticsConsent: undefined,
        action: submitter?.value || 'overview',
      }).sort(),
    ),
  );
  values.termsVersion = TERMS_VERSION;
  values.consent = values.consent === 'on';
  values.eligible = values.eligible === 'on';
  values.statisticsConsent = values.statisticsConsent === 'on';
  values.action = submitter?.value || 'overview';
  const results = form.parentElement.querySelector('.ai-results');
  form.dataset.busy = 'true';
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((b) => (b.disabled = true));
  results.textContent = 'Consultando fontes na internet…';
  current = null;
  try {
    const cached = recentAnswers.get(fingerprint);
    if (cached && Date.now() - Date.parse(cached.generatedAt) < 6 * 3600000) {
      current = cached;
      results.innerHTML = answerMarkup(current);
      attachSuggestions(results, current.searchSuggestions);
      refreshIcons();
      return;
    }
    const response = await fetch(`${import.meta.env.BASE_URL}api/assistant/ask`, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Consulta indisponível.');
    current = {
      id: crypto.randomUUID(),
      title: `${AI_TOPICS[values.topic]} · ${[values.city, values.state].filter(Boolean).join(' / ') || 'Brasil'}`,
      text: data.text,
      sources: data.sources,
      generatedAt: data.generatedAt,
      model: data.model,
      searchSuggestions: data.searchSuggestions,
    };
    results.innerHTML = answerMarkup(current);
    recentAnswers.set(fingerprint, current);
    if (recentAnswers.size > 20) recentAnswers.delete(recentAnswers.keys().next().value);
    attachSuggestions(results, data.searchSuggestions);
    refreshIcons();
  } catch (error) {
    results.textContent = error.message;
  } finally {
    delete form.dataset.busy;
    buttons.forEach((b) => (b.disabled = false));
  }
}
export function chatAction(action, id) {
  if (action === 'save-chat' && current && enabled('alerts')) {
    state.chats = [...(state.chats || []).filter((c) => c.id !== current.id), current].slice(-20);
    saveLocal();
    toast(
      state.cacheWarning
        ? 'Salvo apenas nesta sessão: armazenamento bloqueado.'
        : 'Consulta salva na Minha Sala de Aula deste navegador.',
    );
    return true;
  }
  if (action === 'delete-chat') {
    state.chats = (state.chats || []).filter((c) => c.id !== id);
    saveLocal();
    return true;
  }
  return false;
}
