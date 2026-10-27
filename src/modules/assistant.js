import { state, saveLocal, enabled } from '../api.js';
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
export function assistantPanel(topic = 'jobs', query = '') {
  if (!allowed(topic)) return '';
  if (state.config.ai?.interactive !== true)
    return `<article class="card assistant"><div class="meta">${icon('messages-square')} Consulta individual</div><h2>${h(AI_TOPICS[topic])}</h2><p>As consultas com busca na internet estão aguardando ativação. Você pode pesquisar e filtrar as publicações já disponíveis no catálogo.</p><a class="button" href="#/direitos">Ver publicações e filtros</a></article>`;
  const p = state.profile;
  return `<section class="card assistant"><div class="meta">${icon('messages-square')} Consulta com fontes</div><h2>${h(AI_TOPICS[topic])}</h2><p>Escolha os filtros e uma pergunta. A busca só acontece quando você enviar; a disponibilidade depende da limite de consultas compartilhado.</p><form data-form="assistant" class="stack"><input type="hidden" name="topic" value="${h(topic)}"><div class="form-grid">${select('state', 'Estado', BRAZIL_STATES, p.state)}${field('city', 'Cidade (opcional)', p.city || '', 'text', 'maxlength="80"')}${select('role', 'Cargo', AI_ROLES, 'Professor', false)}${select('level', 'Nível de ensino', AI_LEVELS, 'Todos', false)}${select('network', 'Rede', AI_NETWORKS, 'Todas', false)}${topic === 'search' ? field('query', 'Assunto de educação', query, 'search', 'required maxlength="120"') : ''}</div><label class="ai-consent"><input type="checkbox" name="eligible" required> Tenho 18 anos ou mais, sou profissional da educação e estou no Brasil.</label><label class="ai-consent"><input type="checkbox" name="consent" required> Autorizo enviar estes filtros ao Google para esta consulta. Não informe dados pessoais.</label><div class="form-actions">${Object.entries(
    actionsForTopic(topic),
  )
    .map(
      ([value, label]) =>
        `<button class="button ${value === 'overview' ? 'primary' : ''}" name="action" value="${h(value)}">${h(label)}</button>`,
    )
    .join('')}</div></form><div class="ai-results stack" aria-live="polite"></div></section>`;
}
export function jobsPage() {
  return (
    heading(
      'Próximos passos',
      'Oportunidades',
      'Uma conversa objetiva para encontrar vagas e os canais oficiais de candidatura.',
    ) + assistantPanel('jobs')
  );
}
function answerMarkup(answer, saved = false) {
  return `<article class="card ai-answer"><div class="meta">${h(answer.title)} · ${h(new Date(answer.generatedAt).toLocaleString('pt-BR'))}</div><div class="ai-text">${h(answer.text)}</div><h3>Fontes consultadas</h3><ul>${(answer.sources || []).map((s) => `<li>${external(s.url, s.title)}</li>`).join('')}</ul><p class="muted small-text">Resposta por IA (${h(answer.model)}). Confira informações, prazos e vigência nas fontes originais.</p>${saved ? '' : `<div class="ai-suggestions"></div>${enabled('alerts') ? '<button class="button" data-action="save-chat">Salvar em Meus Alertas neste navegador</button>' : ''}`}</article>`;
}
export function savedChats() {
  state.chats = (state.chats || [])
    .filter((c) => Date.parse(c.generatedAt) > Date.now() - 90 * 86400000)
    .slice(-20);
  return `<h2>Consultas que você salvou</h2><p class="muted">Até 20 consultas por 90 dias, somente neste navegador. Limpar os dados locais apaga o histórico. Nenhum chat é salvo no servidor.</p><div class="masonry">${state.chats.map((c) => `<section>${answerMarkup(c, true)}<button class="button small" data-action="delete-chat" data-id="${h(c.id)}">Apagar esta consulta</button></section>`).join('') || empty('Nenhuma consulta salva', 'Após uma resposta da IA, use Salvar em Meus Alertas.')}</div>`;
}
export async function submitAssistant(form, submitter) {
  if (form.dataset.busy) return;
  const values = Object.fromEntries(new FormData(form));
  values.consent = values.consent === 'on';
  values.eligible = values.eligible === 'on';
  values.action = submitter?.value || 'overview';
  const results = form.parentElement.querySelector('.ai-results');
  form.dataset.busy = 'true';
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((b) => (b.disabled = true));
  results.textContent = 'Consultando fontes na internet…';
  current = null;
  try {
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
    };
    results.innerHTML = answerMarkup(current);
    if (data.searchSuggestions) {
      // Google's attribution HTML is isolated: no scripts, same-origin access, forms or top navigation.
      const frame = document.createElement('iframe');
      frame.title = 'Sugestões de pesquisa do Google';
      frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      frame.referrerPolicy = 'no-referrer';
      frame.className = 'google-suggestions';
      frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://www.google.com https://www.gstatic.com data:; base-uri 'none'"><base target="_blank">${data.searchSuggestions}`;
      results.querySelector('.ai-suggestions').append(frame);
    }
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
        : 'Consulta salva neste navegador em Meus Alertas.',
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
