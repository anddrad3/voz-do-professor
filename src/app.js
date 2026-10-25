import './styles.css';
import { state, api, loadRecords } from './api.js';
import {
  h,
  icon,
  refreshIcons,
  toast,
  dialog,
  download,
  field,
  heading,
  empty,
  fmtDate,
} from './ui.js';
import { home, catalog, detail, loadMap, exportCalendar, globalSearch } from './modules/catalog.js';
import {
  voice,
  survey,
  results,
  story,
  withdrawal,
  reportCSV,
  submitVoice,
} from './modules/voice.js';
import { profile, notifications, privacyRequest, submitProfile } from './modules/profile.js';
import { transparency } from './modules/transparency.js';
import { admin, adminAction, submitAdmin } from './modules/admin.js';
const nav = [
  ['inicio', 'Início', 'house'],
  ['direitos', 'Direitos e Notícias', 'newspaper'],
  ['radar', 'Radar de Escolas', 'map-pinned'],
  ['oportunidades', 'Oportunidades', 'briefcase-business'],
  ['voz', 'Voz do Professor', 'messages-square'],
  ['alertas', 'Meus Alertas', 'bell'],
  ['perfil', 'Meu Perfil', 'user-round'],
  ['transparencia', 'Transparência', 'shield-check'],
];
let renderVersion = 0;
let speechId = null;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  const button = document.querySelector('#theme-toggle');
  button.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
  button.innerHTML = icon(dark ? 'sun' : 'moon');
  try {
    localStorage.setItem('voz-theme', theme);
  } catch {}
  refreshIcons();
}
try {
  applyTheme(localStorage.getItem('voz-theme') || 'dark');
} catch {
  applyTheme('dark');
}
async function refreshAccount() {
  state.favorites.clear();
  if (state.user) {
    const [favorites, alerts] = await Promise.all([
      api('/account/favorites'),
      api('/account/notifications'),
    ]);
    favorites.forEach((r) => {
      state.favorites.add(r.id);
      state.records.set(r.id, r);
    });
    const unread = alerts.filter((a) => !a.read_at).length;
    const badge = document.querySelector('#notification-count');
    badge.hidden = !unread;
    badge.textContent = String(unread);
  } else document.querySelector('#notification-count').hidden = true;
  document.querySelector('#account-link').innerHTML =
    icon('user-round') + `<span>${h(state.user ? state.user.name.split(' ')[0] : 'Entrar')}</span>`;
  document
    .querySelector('#account-link')
    .setAttribute('aria-label', state.user ? 'Abrir meu perfil' : 'Entrar na conta');
  refreshIcons();
}
function route() {
  const [area = 'inicio', id] = location.hash.replace(/^#\/?/, '').split('/');
  let decoded = '';
  try {
    decoded = decodeURIComponent(id || '');
  } catch {}
  return { area: area || 'inicio', id: decoded };
}
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#main').focus();
  document.querySelector('#main').scrollIntoView();
});
async function render() {
  const version = ++renderVersion;
  const { area, id } = route();
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
  document.querySelector('#navigation').innerHTML =
    nav
      .map(
        ([key, name, ico]) =>
          `<a class="nav-link ${area === key ? 'active' : ''}" href="#/${key}" ${area === key ? 'aria-current="page"' : ''}>${icon(ico)}${name}</a>`,
      )
      .join('') +
    (state.user?.role === 'admin'
      ? `<a class="nav-link ${area === 'admin' ? 'active' : ''}" href="#/admin">${icon('settings-2')}Gestão</a>`
      : '');
  document.querySelector('#environment-note').innerHTML = state.config.demo
    ? '<div class="demo-note"><span></span>Ambiente de demonstração · exemplos identificados nos cards · nenhuma vaga ou notícia demonstrativa é real</div>'
    : '';
  const main = document.querySelector('#main');
  main.setAttribute('aria-busy', 'true');
  try {
    let output;
    switch (area) {
      case 'busca':
        output = await globalSearch(id);
        break;
      case 'inicio':
        output = await home();
        break;
      case 'direitos':
        output = await catalog('content');
        break;
      case 'radar':
        output = await catalog('school');
        break;
      case 'oportunidades':
        output = await catalog('opportunity');
        break;
      case 'voz':
        output = await voice();
        break;
      case 'resultados':
        output = await results();
        break;
      case 'perfil':
        output = await profile();
        break;
      case 'alertas':
        output = await notifications();
        break;
      case 'transparencia':
        output = transparency();
        break;
      case 'admin':
        output = await admin();
        break;
      case 'detalhe':
        output = await detail(id);
        if (output === null) output = await survey(id);
        break;
      default:
        output = empty('Página não encontrada', 'Escolha uma área no menu acima.');
    }
    if (version !== renderVersion) return;
    main.innerHTML = output;
    document.title =
      (nav.find((n) => n[0] === area)?.[1] ||
        { admin: 'Administração', busca: 'Busca', resultados: 'Resultados' }[area] ||
        'Publicação') + ' · Voz do Professor';
    refreshIcons();
  } catch (error) {
    if (version === renderVersion)
      main.innerHTML =
        empty('Não foi possível abrir esta área', error.message) +
        `<div class="form-actions"><button class="button" data-action="retry">Tentar novamente</button><a class="button" href="#/inicio">Voltar ao início</a></div>`;
  } finally {
    if (version === renderVersion) main.removeAttribute('aria-busy');
  }
}
const ctx = { render, refreshAccount };
document.addEventListener('click', async (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  event.preventDefault();
  try {
    if (action === 'theme') {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      return;
    }
    if (action === 'close-dialog') {
      document.querySelector('#dialog').close();
      return;
    }
    if (action === 'retry') {
      await render();
      return;
    }
    if (action === 'search') {
      dialog(
        'Buscar na plataforma',
        `<form data-form="global-search" class="stack">${field('q', 'Palavra-chave', '', 'search', 'required autofocus placeholder="Legislação, carreira, oportunidades…"')}<button class="button primary">Pesquisar</button></form>`,
      );
      return;
    }
    if (action === 'favorite') {
      if (!state.user) {
        toast('Entre para salvar seus favoritos.');
        location.hash = '#/perfil';
        return;
      }
      const id = el.dataset.id,
        saved = state.favorites.has(id);
      await api(`/account/favorites/${encodeURIComponent(id)}`, {
        method: saved ? 'DELETE' : 'POST',
        body: {},
      });
      saved ? state.favorites.delete(id) : state.favorites.add(id);
      document.querySelectorAll('[data-action="favorite"]').forEach((button) => {
        if (button.dataset.id !== id) return;
        button.setAttribute('aria-pressed', String(!saved));
        button.setAttribute(
          'aria-label',
          saved ? 'Adicionar aos favoritos' : 'Remover dos favoritos',
        );
        button.innerHTML =
          icon(saved ? 'bookmark' : 'bookmark-check') +
          (button.classList.contains('icon-button') ? '' : saved ? 'Salvar' : 'Salvo');
      });
      refreshIcons();
      toast(saved ? 'Removido dos favoritos.' : 'Salvo nos seus favoritos.');
      return;
    }
    if (action === 'citation') {
      const r = state.records.get(el.dataset.id);
      const text = `${r.sourceName || 'VOZ DO PROFESSOR'}. ${r.title}. ${r.sourceDate ? fmtDate(r.sourceDate) : ''}. ${r.sourceUrl || location.href}. Curadoria: ${r.reviewer || 'Demonstração sem validação humana'}.${r.demo ? ' CONTEÚDO DEMONSTRATIVO.' : ''}`;
      try {
        await navigator.clipboard.writeText(text);
        toast('Referência copiada.');
      } catch {
        dialog(
          'Referência para copiar',
          `<textarea readonly aria-label="Referência">${h(text)}</textarea>`,
        );
      }
      return;
    }
    if (action === 'audio') {
      if (!('speechSynthesis' in window)) {
        toast('Este navegador não oferece leitura em voz alta.');
        return;
      }
      const r = state.records.get(el.dataset.id);
      speechSynthesis.cancel();
      document
        .querySelectorAll('[data-action="audio"]')
        .forEach((b) => (b.innerHTML = icon('play') + 'Ouvir'));
      if (speechId === r.id) {
        speechId = null;
        refreshIcons();
        return;
      }
      speechId = r.id;
      const utterance = new SpeechSynthesisUtterance(
        [r.title, r.body, r.summary].filter(Boolean).join('. '),
      );
      utterance.lang = 'pt-BR';
      const localVoice = speechSynthesis
        .getVoices()
        .find((v) => v.lang.startsWith('pt') && v.localService);
      if (localVoice) utterance.voice = localVoice;
      utterance.onend = utterance.onerror = () => {
        speechId = null;
        el.innerHTML = icon('play') + 'Ouvir';
        refreshIcons();
      };
      el.innerHTML = icon('square') + 'Parar';
      speechSynthesis.speak(utterance);
      refreshIcons();
      return;
    }
    if (action === 'content-category') {
      state.filters.content = { type: el.dataset.value };
      if (route().area === 'direitos') await render();
      else location.hash = '#/direitos';
      return;
    }
    if (action === 'clear-filters') {
      state.filters[el.dataset.kind] = {};
      await render();
      return;
    }
    if (action === 'geolocate') {
      if (!navigator.geolocation)
        throw new Error('Geolocalização indisponível. Informe as coordenadas manualmente.');
      const form = el.closest('form');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          form.elements.lat.value = pos.coords.latitude.toFixed(4);
          form.elements.lng.value = pos.coords.longitude.toFixed(4);
          toast('Localização preenchida. Aplique os filtros ou salve o perfil.');
        },
        () =>
          toast('Localização não autorizada ou indisponível. Informe as coordenadas manualmente.'),
        { enableHighAccuracy: false, timeout: 12000 },
      );
      return;
    }
    if (action === 'city-center') {
      const form = el.closest('form');
      const city = form.elements.city.value.trim().toLocaleLowerCase('pt-BR');
      if (!city) throw new Error('Informe o município primeiro.');
      const schools = await loadRecords('school');
      const matches = schools.filter(
        (s) =>
          s.city.toLocaleLowerCase('pt-BR') === city &&
          s.lat != null &&
          s.lng != null &&
          (!form.elements.state.value || s.state === form.elements.state.value),
      );
      if (!matches.length)
        throw new Error(
          'Não há coordenadas dessa cidade na base. Informe sua localização manualmente.',
        );
      form.elements.lat.value = (matches.reduce((a, b) => a + b.lat, 0) / matches.length).toFixed(
        4,
      );
      form.elements.lng.value = (matches.reduce((a, b) => a + b.lng, 0) / matches.length).toFixed(
        4,
      );
      toast('Referência aproximada calculada pelas escolas cadastradas. Aplique os filtros.');
      return;
    }
    if (action === 'load-map') {
      await loadMap();
      return;
    }
    if (action === 'calendar-toggle') {
      state.showCalendar = !state.showCalendar;
      await render();
      return;
    }
    if (action === 'month-prev' || action === 'month-next') {
      state.calendarOffset += action === 'month-prev' ? -1 : 1;
      await render();
      return;
    }
    if (action === 'export-calendar') {
      exportCalendar(el.dataset.id ? [state.records.get(el.dataset.id)] : state.currentItems || []);
      return;
    }
    if (action === 'new-story') {
      story();
      return;
    }
    if (action === 'new-suggestion') {
      story('Sugestão');
      return;
    }
    if (action === 'withdraw') {
      withdrawal();
      return;
    }
    if (action === 'download-receipt') {
      download(
        'comprovante-voz-do-professor.txt',
        `Comprovante de participação anônima\n\n${el.dataset.receipt}\n\nGuarde este código para retirar sua participação em Voz do Professor.\n`,
        'text/plain;charset=utf-8',
      );
      return;
    }
    if (action === 'report-csv') {
      reportCSV();
      return;
    }
    if (action === 'report-json') {
      download('resultados-agregados.json', JSON.stringify(state.report, null, 2));
      return;
    }
    if (action === 'print') {
      window.print();
      return;
    }
    if (action === 'logout') {
      await api('/account/logout', { method: 'POST', body: {} });
      state.user = null;
      state.csrf = null;
      await refreshAccount();
      await render();
      return;
    }
    if (action === 'export-account') {
      download(
        'meus-dados-voz-do-professor.json',
        JSON.stringify(await api('/account/privacy/export'), null, 2),
      );
      return;
    }
    if (action === 'privacy-request') {
      privacyRequest();
      return;
    }
    if (action === 'read-all' || action === 'read-notification') {
      await api('/account/notifications/read', {
        method: 'POST',
        body: action === 'read-notification' ? { id: el.dataset.id } : {},
      });
      await refreshAccount();
      await render();
      return;
    }
    await adminAction(action, el, ctx);
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form,
    v = Object.fromEntries(new FormData(form));
  const button = event.submitter;
  form.querySelector('.form-error')?.remove();
  if (button) button.disabled = true;
  try {
    if (type === 'filter') {
      state.filters[form.dataset.kind] = v;
      await render();
    } else if (type === 'global-search') {
      document.querySelector('#dialog').close();
      const destination = '#/busca/' + encodeURIComponent(v.q.trim());
      if (location.hash === destination) await render();
      else location.hash = destination;
    } else if (await submitVoice(type, form, v)) {
    } else if (await submitProfile(type, form, v, ctx)) {
    } else await submitAdmin(type, form, v, ctx);
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'form-error';
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    form.append(message);
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});
window.addEventListener('hashchange', () => {
  document.querySelector('#dialog').close();
  window.scrollTo(0, 0);
  void render();
});
window.addEventListener('pagehide', () => window.speechSynthesis?.cancel());
async function boot() {
  try {
    const [session, config] = await Promise.all([api('/account/session'), api('/config')]);
    state.user = session.user;
    state.csrf = session.csrf;
    state.config = config;
    await refreshAccount();
    await render();
  } catch (error) {
    document.querySelector('#main').innerHTML =
      empty('Servidor indisponível', error.message) +
      `<button class="button" data-action="reload">Recarregar</button>`;
    document
      .querySelector('[data-action="reload"]')
      ?.addEventListener('click', () => location.reload());
  }
}
void boot();
