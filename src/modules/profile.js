import { photoField, editedPhoto } from './photo-editor.js';
import { greeting } from './personalization.js';
import { state, loadRecords, localAlerts, saveLocal, enabled } from '../api.js';
import { savedChats } from './assistant.js';
import {
  viewControls,
  h,
  heading,
  field,
  select,
  check,
  card,
  empty,
  notice,
  icon,
} from '../ui.js';
const states =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export async function profile() {
  const p = state.profile;
  const all = (
    await Promise.all(
      ['content', 'school', 'opportunity', 'story', 'survey'].map((k) => loadRecords(k)),
    )
  ).flat();
  const saved = new Map(state.savedRecords.map((r) => [r.id, r]));
  all.filter((r) => state.favorites.has(r.id)).forEach((r) => saved.set(r.id, r));
  const favorites = [...saved.values()].filter((r) => state.favorites.has(r.id));
  favorites.forEach((r) => state.records.set(r.id, r));
  const alerts = localAlerts(all.filter((r) => r.kind === 'content' || r.kind === 'opportunity'));
  state.currentAlerts = alerts;
  return (
    heading(
      'Somente neste navegador',
      'Minha Sala de Aula',
      'Sua região, publicações favoritas, vagas salvas, consultas e novidades em um só lugar.',
    ) +
    greeting('Este é seu espaço para guardar publicações, consultas e preferências.') +
    notice(
      'Preferências, favoritos e alertas ficam no armazenamento local deste navegador. Limpar os dados do navegador apaga essas informações. Quem usa este mesmo navegador pode vê-las.',
    ) +
    (enabled('preferences')
      ? `<article class="card"><h2>Meu perfil, região e interesses</h2><p class="muted">Nome e foto são opcionais, ficam somente neste navegador e não são enviados à IA.</p><form data-form="local-profile"><div class="form-grid">${field('name', 'Como quer ser chamado', p.name || '', 'text', 'maxlength="60"')}${photoField(p.avatar)}${check('removeAvatar', 'Remover minha foto local', false)}${field('country', 'País (código de duas letras)', p.country || 'BR', 'text', 'maxlength="2"')}${select('state', 'Estado', states, p.state)}${field('city', 'Cidade', p.city || '')}${field('discipline', 'Disciplina ou área', p.discipline || '')}</div><div class="form-actions"><button type="button" class="button" data-action="geolocate">${icon('locate-fixed')}Usar localização com minha permissão</button></div><div class="stack">${check('news', 'Notícias', state.preferences.news)}${check('legislation', 'Direitos e legislação', state.preferences.legislation)}${check('opportunities', 'Oportunidades', state.preferences.opportunities)}</div><div class="form-actions"><button class="button primary">Salvar neste navegador</button><button type="button" class="button" data-action="clear-local">Apagar meus dados locais</button></div></form></article>`
      : '') +
    (enabled('favorites')
      ? `<div class="section-title"><h2>Publicações que você salvou</h2></div>${viewControls(state)}<div class="masonry">${favorites.length ? favorites.map((r) => card(r, state)).join('') : empty('Nenhum favorito salvo', 'Use o marcador nos cards para guardar publicações neste navegador.')}</div>`
      : '') +
    (enabled('alerts') ? savedChats() + alertsMarkup(alerts) : '')
  );
}
function alertsMarkup(alerts) {
  return `<section><div class="section-title"><h2>Novidades para sua região</h2><button class="button" data-action="read-all">Marcar todos como lidos</button></div><p class="muted">Avisos comparados às suas preferências quando você abre o site. Sem e-mail, push ou rastreamento.</p><div class="masonry">${
    alerts
      .slice(0, 30)
      .map(
        (r) =>
          `<article class="card"><div class="meta">${r.read ? 'Lido' : 'Novo para você'}</div><h3><a href="#/detalhe/${encodeURIComponent(r.id)}">${h(r.title)}</a></h3><p>${h(r.sourceName)}</p><button class="button small" data-action="favorite" data-id="${h(r.id)}">${state.favorites.has(r.id) ? 'Salvo' : 'Salvar na Minha Sala de Aula'}</button><button class="button small" data-action="read-notification" data-id="${h(r.alertKey)}">Marcar como lido</button></article>`,
      )
      .join('') || empty('Nenhuma novidade para sua região')
  }</div></section>`;
}
export const notifications = profile;
export async function submitProfile(type, form, v) {
  if (type !== 'local-profile') return false;
  const photo = editedPhoto(form);
  state.profile = {
    name: String(v.name || '')
      .trim()
      .slice(0, 60),
    avatar: v.removeAvatar ? '' : photo || state.profile.avatar || '',
    country: v.country.toUpperCase(),
    state: v.state,
    city: v.city.trim(),
    discipline: v.discipline.trim(),
    radius: 0,
    lat: null,
    lng: null,
  };
  state.filters = {};
  state.preferences = {
    news: !!v.news,
    legislation: !!v.legislation,
    opportunities: !!v.opportunities,
  };
  saveLocal();
  return true;
}
