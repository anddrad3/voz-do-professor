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
  const favorites = all.filter((r) => state.favorites.has(r.id));
  return (
    heading(
      'Somente neste navegador',
      'Minha Sala de Aula',
      'Sem cadastro, senha ou envio das suas preferências ao servidor.',
    ) +
    notice(
      'Preferências, favoritos e alertas ficam no armazenamento local deste navegador. Limpar os dados do navegador apaga essas informações. Quem usa este mesmo navegador pode vê-las.',
    ) +
    (enabled('preferences')
      ? `<article class="card"><h2>Minha região e interesses</h2><form data-form="local-profile"><div class="form-grid">${field('country', 'País (código de duas letras)', p.country || 'BR', 'text', 'maxlength="2"')}${select('state', 'Estado', states, p.state)}${field('city', 'Cidade', p.city || '')}${field('discipline', 'Disciplina ou área', p.discipline || '')}${select(
          'radius',
          'Raio de alertas de vagas',
          [
            [0, 'Sem raio'],
            [5, '5 km'],
            [10, '10 km'],
            [25, '25 km'],
            [50, '50 km'],
          ],
          p.radius || 0,
          false,
        )}${field('lat', 'Latitude (somente local)', p.lat ?? '', 'number', 'step="any" min="-90" max="90"')}${field('lng', 'Longitude (somente local)', p.lng ?? '', 'number', 'step="any" min="-180" max="180"')}</div><div class="form-actions"><button type="button" class="button" data-action="geolocate">${icon('locate-fixed')}Usar localização com minha permissão</button></div><div class="stack">${check('news', 'Notícias', state.preferences.news)}${check('legislation', 'Direitos e legislação', state.preferences.legislation)}${check('opportunities', 'Oportunidades', state.preferences.opportunities)}</div><div class="form-actions"><button class="button primary">Salvar neste navegador</button><button type="button" class="button" data-action="clear-local">Apagar meus dados locais</button></div></form></article>`
      : '') +
    (enabled('favorites')
      ? `<div class="section-title"><h2>Favoritos neste navegador</h2></div>${viewControls(state)}<div class="masonry">${favorites.length ? favorites.map((r) => card(r, state)).join('') : empty('Nenhum favorito salvo', 'Use o marcador nos cards para guardar publicações neste navegador.')}</div>`
      : '')
  );
}
export async function notifications() {
  const items = (await Promise.all([loadRecords('content'), loadRecords('opportunity')])).flat();
  const alerts = localAlerts(items);
  state.currentAlerts = alerts;
  return (
    heading(
      'Avisos sem conta',
      'Meus alertas',
      'Novidades são comparadas às suas preferências quando você abre o site. Não há e-mail, push ou rastreamento.',
    ) +
    `<div class="form-actions"><a class="button" href="#/perfil">Ajustar interesses</a><button class="button" data-action="read-all">Marcar todos como lidos</button></div>` +
    savedChats() +
    `<div class="stack">${alerts.map((r) => `<article class="notification"><div class="content"><h3><a href="#/detalhe/${encodeURIComponent(r.id)}">${h(r.title)}</a></h3><p class="muted small-text">${h(r.sourceName)} · ${r.read ? 'Lido neste navegador' : 'Novo para você'}</p></div><button class="button small" data-action="read-notification" data-id="${h(r.alertKey)}">Marcar como lido</button></article>`).join('') || empty('Nenhuma novidade para seus filtros')}</div>`
  );
}
export function submitProfile(type, form, v) {
  if (type !== 'local-profile') return false;
  if (Number(v.radius) > 0 && (v.lat === '' || v.lng === ''))
    throw new Error('Autorize a localização ou informe coordenadas para usar raio.');
  state.profile = {
    country: v.country.toUpperCase(),
    state: v.state,
    city: v.city.trim(),
    discipline: v.discipline.trim(),
    radius: Number(v.radius),
    lat: v.lat === '' ? null : Number(v.lat),
    lng: v.lng === '' ? null : Number(v.lng),
  };
  state.preferences = {
    news: !!v.news,
    legislation: !!v.legislation,
    opportunities: !!v.opportunities,
  };
  saveLocal();
  return true;
}
