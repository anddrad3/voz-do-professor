import { versionsPage } from './modules/versions.js';
import { termsPage } from './modules/transparency.js';
import { greeting } from './modules/personalization.js';
import { installMotion } from './modules/motion.js';
import { locateForm } from './modules/location.js';
import './styles.css';
import {
  state,
  api,
  loadRecords,
  enabled,
  saveLocal,
  clearLocal,
  localAlerts,
  locationFilters,
  toggleFavorite,
} from './api.js';
import { h, icon, refreshIcons, toast, dialog, field, empty, fmtDate, arrangeCards } from './ui.js';
import { home, catalog, detail, radar, exportCalendar, globalSearch } from './modules/catalog.js';
import { voice, survey, story, withdrawal } from './modules/voice.js';
import { profile, notifications, submitProfile } from './modules/profile.js';
import { transparency } from './modules/transparency.js';
import { jobsPage, submitAssistant, chatAction, hydrateSavedChats } from './modules/assistant.js';
import { statisticsPage, setStatisticsPeriod, exportStatistics } from './modules/statistics.js';
const nav = [
  ['inicio', 'Início', 'house', null],
  ['direitos', 'Direitos e Notícias', 'newspaper', 'content'],
  ['radar', 'Radar de Escolas', 'map-pinned', 'school'],
  ['oportunidades', 'Oportunidades', 'briefcase-business', 'opportunity'],
  ['concursos', 'Concursos públicos', 'calendar-days', 'contests'],
  ['voz', 'Voz do Professor', 'messages-square', 'voice'],
  ['estatisticas', 'Estatísticas', 'chart-pie', 'statistics'],
  ['perfil', 'Minha Sala de Aula', 'chalkboard-user', 'preferences'],
  ['versoes', 'Versões e mudanças', 'clock', 'versions'],
  ['transparencia', 'Transparência', 'shield-check', null],
];
let version = 0,
  speechId = null;
function theme(value) {
  document.documentElement.dataset.theme = value;
  const b = document.querySelector('#theme-toggle');
  b.setAttribute('aria-label', value === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  b.innerHTML = icon(value === 'dark' ? 'sun' : 'moon');
  try {
    localStorage.setItem('voz-theme', value);
  } catch {}
  refreshIcons();
}
try {
  theme(localStorage.getItem('voz-theme') || 'dark');
} catch {
  theme('dark');
}
const route = () => {
  const [area = 'inicio', raw = ''] = location.hash.replace(/^#\/?/, '').split('/');
  let id = '';
  try {
    id = decodeURIComponent(raw);
  } catch {}
  return { area: area || 'inicio', id };
};
async function render() {
  const revision = ++version;
  const { area, id } = route();
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
  // Recheck switches every navigation; a disabled section is also blocked on the server.
  state.config = await api('/config');
  const any = Object.values(state.config.features).some(Boolean);
  const navigation = document.querySelector('#navigation');
  navigation.innerHTML = any
    ? nav
        .filter(
          (n) =>
            !n[3] ||
            enabled(n[3]) ||
            (n[0] === 'perfil' && (enabled('favorites') || enabled('alerts'))),
        )
        .map(
          ([k, label, ico]) =>
            `<a class="nav-link ${k === area ? 'active' : ''}" href="#/${k}" ${k === area ? 'aria-current="page"' : ''}>${icon(ico)}${label}</a>`,
        )
        .join('')
    : '';
  document.querySelector('[data-action="search"]').hidden = !enabled('search');
  document.querySelector('#account-link').hidden =
    !enabled('preferences') && !enabled('favorites') && !enabled('alerts');
  document.querySelector('#theme-toggle').hidden = !enabled('theme');
  document.querySelector('[data-action="menu-toggle"]').hidden = !any || !enabled('navigation');
  if (!enabled('navigation')) {
    navigation.hidden = false;
    document.querySelector('[data-action="menu-toggle"]').setAttribute('aria-expanded', 'true');
  }
  document.querySelector('.footer a[download]').hidden = !enabled('guide');
  if (!enabled('viewModes')) state.view = 'grid';
  document.querySelector('.footer').hidden = !any;
  document.querySelector('#environment-note').innerHTML =
    any && state.config.demo
      ? '<div class="demo-note"><span></span>Exemplos identificados nos cards · notícias automáticas mostram sua fonte original</div>'
      : '';
  const main = document.querySelector('#main');
  main.setAttribute('aria-busy', 'true');
  try {
    let output = '';
    const feature = nav.find((n) => n[0] === area)?.[3] || (area === 'busca' ? 'search' : null);
    if (!any) output = '';
    else if (
      feature &&
      !enabled(feature) &&
      !(area === 'perfil' && (enabled('favorites') || enabled('alerts')))
    )
      output = empty('Área indisponível', 'Esta ferramenta está desativada no momento.');
    else
      switch (area) {
        case 'inicio':
          output = await home();
          break;
        case 'busca':
          output = await globalSearch(id);
          break;
        case 'direitos':
          output = await catalog('content');
          break;
        case 'radar':
          output = radar();
          break;
        case 'oportunidades':
          output = jobsPage();
          break;
        case 'concursos':
          output = await catalog('contests');
          break;
        case 'voz':
          output = await voice();
          break;
        case 'estatisticas':
          output = await statisticsPage();
          break;
        case 'perfil':
          output = await profile();
          break;
        case 'alertas':
          output = await notifications();
          break;
        case 'versoes':
          output = await versionsPage();
          break;
        case 'termos':
          output = termsPage();
          break;
        case 'transparencia':
          output = transparency();
          break;
        case 'detalhe':
          output = await detail(id);
          if (output === null) output = await survey(id);
          break;
        default:
          output = empty('Página não encontrada');
      }
    if (revision !== version) return;
    main.innerHTML =
      (any && ['inicio', 'direitos', 'radar', 'concursos'].includes(area)
        ? greeting('Explore as informações e ajuste os filtros à sua região.')
        : '') + output;
    main
      .querySelectorAll('[data-action="geolocate"]')
      .forEach((b) => (b.hidden = !enabled('geolocation')));
    main
      .querySelectorAll('[data-action="citation"]')
      .forEach((b) => (b.hidden = !enabled('citations')));
    main.querySelectorAll('.view-controls').forEach((b) => (b.hidden = !enabled('viewModes')));
    main.dataset.view = state.view;
    hydrateSavedChats(main);
    arrangeCards();
    if (output && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      main.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
    document.title = (nav.find((n) => n[0] === area)?.[1] || 'Publicação') + ' · Voz do Professor';
    refreshIcons();
  } catch (e) {
    if (revision === version)
      main.innerHTML =
        empty('Não foi possível abrir esta área', e.message) +
        `<button class="button" data-action="retry">Tentar novamente</button>`;
  } finally {
    if (revision === version) main.removeAttribute('aria-busy');
  }
}
document.querySelector('.skip').addEventListener('click', (e) => {
  e.preventDefault();
  document.querySelector('#main').focus();
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  const action = el.dataset.action;
  try {
    if (chatAction(action, el.dataset.id)) {
      if (action === 'delete-chat') await render();
      return;
    }
    if (action === 'view') {
      state.view = el.dataset.view === 'list' ? 'list' : 'grid';
      saveLocal();
      await render();
      return;
    }
    if (action === 'menu-toggle') {
      const nav = document.querySelector('#navigation');
      nav.hidden = !nav.hidden;
      el.setAttribute('aria-expanded', String(!nav.hidden));
      el.setAttribute('aria-label', nav.hidden ? 'Expandir menu' : 'Recolher menu');
      return;
    }
    if (action === 'theme') {
      theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      document
        .querySelectorAll('.google-suggestions')
        .forEach((f) => (f.style.colorScheme = document.documentElement.dataset.theme));
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
      if (!enabled('search')) return;
      dialog(
        'Buscar na plataforma',
        `<form data-form="global-search" class="stack">${field('q', 'Palavra-chave', '', 'search', 'required autofocus')}<label class="ai-consent"><input type="checkbox" required> Li e aceito os <a href="#/termos" target="_blank" rel="noopener">Termos e Condições</a>.</label><button class="button primary">Pesquisar</button></form>`,
      );
      return;
    }
    if (action === 'favorite') {
      if (!enabled('favorites')) return;
      const id = el.dataset.id;
      toggleFavorite(id);
      document.querySelectorAll('[data-action="favorite"]').forEach((b) => {
        if (b.dataset.id !== id) return;
        const saved = state.favorites.has(id);
        b.setAttribute('aria-pressed', String(saved));
        b.setAttribute('aria-label', saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
        b.innerHTML =
          icon(saved ? 'bookmark-check' : 'bookmark') +
          (b.classList.contains('icon-button') ? '' : saved ? 'Salvo' : 'Salvar');
      });
      refreshIcons();
      toast(
        state.cacheWarning
          ? 'Salvo apenas nesta sessão: armazenamento bloqueado.'
          : 'Favoritos atualizados neste navegador.',
      );
      if (route().area === 'perfil') await render();
      return;
    }
    if (action === 'clear-local') {
      clearLocal();
      theme('dark');
      await render();
      toast('Dados locais apagados.');
      return;
    }
    if (action === 'read-all' || action === 'read-notification') {
      state.readAlerts = [
        ...new Set([
          ...state.readAlerts,
          ...(action === 'read-all'
            ? (state.currentAlerts || []).map((a) => a.alertKey)
            : [el.dataset.id]),
        ]),
      ];
      saveLocal();
      await render();
      return;
    }
    if (action === 'citation') {
      const r = state.records.get(el.dataset.id);
      const text = `${r.sourceName || 'Voz do Professor'}. ${r.title}. ${fmtDate(r.sourceDate)}. ${r.sourceUrl || location.href}. ${r.attribution || ''}`;
      try {
        await navigator.clipboard.writeText(text);
        toast('Referência copiada.');
      } catch {
        dialog('Referência', `<textarea readonly>${h(text)}</textarea>`);
      }
      return;
    }
    if (action === 'audio') {
      if (!enabled('audio')) return;
      if (!window.speechSynthesis) throw new Error('Leitura em voz alta indisponível.');
      speechSynthesis.cancel();
      if (speechId === el.dataset.id) {
        speechId = null;
        el.innerHTML = icon('play') + 'Ouvir';
        refreshIcons();
        return;
      }
      const r = state.records.get(el.dataset.id);
      const u = new SpeechSynthesisUtterance(
        [r.title, r.body, r.summary].filter(Boolean).join('. '),
      );
      u.lang = 'pt-BR';
      const v = speechSynthesis.getVoices().find((v) => v.localService && v.lang.startsWith('pt'));
      if (v) u.voice = v;
      speechId = r.id;
      u.onend = u.onerror = () => {
        speechId = null;
        el.innerHTML = icon('play') + 'Ouvir';
        refreshIcons();
      };
      el.innerHTML = icon('square') + 'Parar';
      speechSynthesis.speak(u);
      refreshIcons();
      return;
    }
    if (action === 'content-category') {
      state.filters.content = { ...locationFilters('content'), type: el.dataset.value };
      if (route().area === 'direitos') await render();
      else location.hash = '#/direitos';
      return;
    }
    if (action === 'clear-filters') {
      state.filters[el.dataset.kind] = {
        country: '',
        state: '',
        city: '',
        type: state.filters[el.dataset.kind]?.type || '',
      };
      await render();
      return;
    }
    if (action === 'geolocate') {
      if (!navigator.geolocation)
        throw new Error('Localização indisponível; escolha sua cidade manualmente.');
      const form = el.closest('form');
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          try {
            const city = await locateForm(form, p.coords);
            toast(
              `Região sugerida: ${city.city} / ${city.state}. Confira antes de consultar ou salvar. GPS processado somente neste navegador.`,
            );
          } catch (error) {
            toast(error.message);
          }
        },
        () => toast('Localização não autorizada. Você pode escolher a região manualmente.'),
        { enableHighAccuracy: false, timeout: 12000 },
      );
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
      if (enabled('calendar'))
        exportCalendar(
          el.dataset.id ? [state.records.get(el.dataset.id)] : state.currentItems || [],
        );
      return;
    }
    if (action === 'new-story' || action === 'new-suggestion') {
      story();
      return;
    }
    if (action === 'withdraw') {
      withdrawal();
      return;
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const type = form.dataset.form,
    v = Object.fromEntries(new FormData(form));
  try {
    if (type === 'assistant') {
      if (e.submitter?.value === 'catalog') {
        const allowed = ['country', 'state', 'city', 'q', 'level', 'network'];
        state.filters[form.dataset.kind] = {
          ...locationFilters(form.dataset.kind),
          ...Object.fromEntries(Object.entries(v).filter(([k]) => allowed.includes(k))),
        };
        await render();
        return;
      }
      await submitAssistant(form, e.submitter);
    } else if (type === 'statistics') {
      setStatisticsPeriod(form);
      await render();
      if (e.submitter?.value === 'pdf') await exportStatistics();
    } else if (type === 'filter') {
      state.filters[form.dataset.kind] = v;
      await render();
    } else if (type === 'global-search') {
      document.querySelector('#dialog').close();
      const dest = '#/busca/' + encodeURIComponent(v.q.trim());
      if (location.hash === dest) await render();
      else location.hash = dest;
    } else if (await submitProfile(type, form, v)) {
      await render();
      toast(
        state.cacheWarning
          ? 'Armazenamento indisponível: alterações valem nesta sessão.'
          : 'Preferências salvas somente neste navegador.',
      );
    }
  } catch (error) {
    toast(error.message);
  }
});
// Clearing the country resets state/city, preventing invisible conflicting filters.
document.addEventListener('change', (e) => {
  const form = e.target.closest('form[data-form="filter"], form[data-form="assistant"]');
  if (!form) return;
  if (e.target.name === 'country' && e.target.value !== 'BR') {
    form.elements.state.value = '';
    form.elements.city.value = '';
  }
  if (e.target.name === 'state') form.elements.city.value = '';
});
window.addEventListener('hashchange', () => {
  document.querySelector('#dialog').close();
  window.scrollTo(0, 0);
  void render();
});
window.addEventListener('pagehide', () => window.speechSynthesis?.cancel());
window.addEventListener('storage', (e) => {
  if (e.key === 'voz-local-v2') location.reload();
});
installMotion();
void render().catch((e) => {
  document.querySelector('#main').innerHTML = empty('Servidor indisponível', e.message);
});
