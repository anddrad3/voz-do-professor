import { state, api } from '../api.js';
import {
  h,
  heading,
  field,
  select,
  textarea,
  check,
  icon,
  notice,
  card,
  empty,
  download,
  dialog,
  toast,
  fmtDate,
} from '../ui.js';
import { LEVELS, STATES } from './catalog.js';
export function auth() {
  return `<div class="reading">${heading('Seu espaço', 'Mais perto do que importa.', 'A informação é pública. Sua conta gratuita reúne preferências, favoritos e alertas.')}<div class="grid"><article class="card"><h2>Entrar</h2><form class="stack" data-form="login" style="margin-top:20px">${field('email', 'E-mail', '', 'email', 'required autocomplete="email"')}${field('password', 'Senha', '', 'password', 'required minlength="12" maxlength="128" autocomplete="current-password"')}<button class="button primary">Entrar na minha conta</button></form><p class="small-text" style="margin-top:15px">Se perdeu o acesso, entre em contato com o responsável indicado em Transparência.</p></article><article class="card"><h2>Criar conta gratuita</h2><form class="stack" data-form="register" style="margin-top:20px">${field('name', 'Como podemos chamar você?', '', 'text', 'required minlength="2" maxlength="120" autocomplete="name"')}${field('email', 'E-mail de cadastro', '', 'email', 'required autocomplete="email"')}${field('password', 'Crie uma senha (mínimo de 12 caracteres)', '', 'password', 'required minlength="12" maxlength="128" autocomplete="new-password"')}${check('consent', 'Li a política de privacidade e concordo com o uso dos dados para manter minha conta.')}<a class="link small-text" href="#/transparencia">Conhecer a política de privacidade</a><button class="button primary">Criar minha conta</button></form></article></div></div>`;
}
export async function profile() {
  if (!state.user) return auth();
  const u = state.user,
    p = u.profile || {},
    prefs = u.preferences || {};
  const favorites = await api('/account/favorites');
  favorites.forEach((r) => state.records.set(r.id, r));
  return (
    heading(
      'Seu espaço',
      `Olá, ${u.name.split(' ')[0]}.`,
      'Seu perfil conecta você às oportunidades que fazem sentido para a sua trajetória.',
      `<button class="button" data-action="logout">${icon('log-out')}Sair</button>`,
    ) +
    `<div class="grid"><article class="card"><h2>Perfil profissional</h2><form data-form="profile" class="stack" style="margin-top:20px"><div class="form-grid two">${field('name', 'Nome', u.name, 'text', 'required minlength="2" maxlength="120"')}${field('city', 'Município de referência', p.city || '')}${select('state', 'Estado', STATES, p.state)}${field('discipline', 'Disciplina de atuação', p.discipline || '', 'text', 'placeholder="Ex.: Matemática"')}${field('education', 'Formação', p.education || '', 'text', 'placeholder="Ex.: Licenciatura"')}${select(
      'radius',
      'Raio de interesse',
      [
        [0, 'Sem limite'],
        [5, '5 km'],
        [10, '10 km'],
        [25, '25 km'],
        [50, '50 km'],
      ],
      p.radius || 0,
      false,
    )}${field('lat', 'Latitude (para alertas por raio)', p.lat ?? '', 'number', 'step="any" min="-90" max="90"')}${field('lng', 'Longitude (para alertas por raio)', p.lng ?? '', 'number', 'step="any" min="-180" max="180"')}${field('cities', 'Outras cidades de interesse (separe por vírgulas)', (p.cities || []).join(', '))}</div><div class="stack"><span class="muted small-text">Níveis de ensino de interesse</span>${LEVELS.filter(
      (l) => l !== 'Todos',
    )
      .map((l) => check('level:' + l, l, p.levels?.includes(l)))
      .join(
        '',
      )}</div><button class="button" type="button" data-action="geolocate">${icon('locate-fixed')}Preencher minha localização</button><h3>Preferências de alertas</h3>${check('opportunities', 'Concursos e seleções compatíveis com meu perfil', prefs.opportunities !== false)}${check('legislation', 'Atualizações normativas', prefs.legislation !== false)}${check('news', 'Notícias educacionais', prefs.news === true)}<p class="small-text muted">Alertas são entregues nesta plataforma. Quando um raio é definido, seleções sem coordenadas ficam de fora até que a localização seja conferida.</p><button class="button primary">Salvar perfil e preferências</button></form></article><div><article class="card"><h2>Privacidade e controle</h2><p style="margin-top:12px">Você decide sobre seus dados. Pesquisas e relatos anônimos não são vinculados à sua conta.</p><p class="small-text">Consentimento da conta: ${fmtDate(u.consentAt)}</p><div class="form-actions"><button class="button" data-action="export-account">${icon('download')}Exportar meus dados</button><button class="button" data-action="privacy-request">Solicitação de privacidade</button><button class="button" data-action="withdraw">Retirar resposta anônima</button></div><details><summary>Alterar senha</summary><form data-form="password" class="stack" style="margin-top:16px">${field('current', 'Senha atual', '', 'password', 'required autocomplete="current-password"')}${field('password', 'Nova senha', '', 'password', 'required minlength="12" maxlength="128" autocomplete="new-password"')}<button class="button">Alterar senha</button></form></details><details><summary>Excluir conta e revogar consentimento</summary><p class="small-text">Apaga perfil, favoritos, alertas e solicitações. Relatos anônimos devem ser retirados pelo comprovante, pois não são vinculados à conta.</p><form data-form="delete-account" class="stack" style="margin-top:16px">${field('password', 'Confirme sua senha', '', 'password', 'required autocomplete="current-password"')}${check('confirm', 'Entendo que esta exclusão é definitiva.')}<button class="button danger">Excluir minha conta</button></form></details></article>${u.role === 'admin' ? `<article class="card accent-block"><h3>Administração e curadoria</h3><p>Revise conteúdos, acompanhe importações e gerencie as pesquisas.</p><a class="button" style="margin-top:16px" href="#/admin">${icon('shield-check')}Abrir painel administrativo</a></article>` : ''}</div></div><div class="section-title" style="margin-top:32px"><h2>Seus favoritos</h2><span class="muted small-text">${favorites.length} itens salvos</span></div><div class="masonry">${favorites.length ? favorites.map((r) => card(r, state)).join('') : empty('Seu acervo começa aqui', 'Salve escolas, editais e publicações usando o ícone de marcador nos cards.')}</div>`
  );
}
export async function notifications() {
  if (!state.user) return auth();
  const items = await api('/account/notifications');
  return (
    heading(
      'Acompanhe de perto',
      'Meus Alertas',
      'Atualizações selecionadas a partir do seu perfil e das suas preferências.',
      `<div class="row"><button class="button" data-action="read-all">Marcar todos como lidos</button><a class="button" href="#/perfil">${icon('sliders-horizontal')}Preferências</a></div>`,
    ) +
    `<div class="stack">${items.length ? items.map((n) => `<article class="notification ${n.read_at ? '' : 'unread'}"><span class="source-icon">${icon('bell')}</span><div class="content"><h3><a href="#/detalhe/${encodeURIComponent(n.record_id)}">${h(n.title)}</a></h3><small>${fmtDate(n.created_at)} · ${n.read_at ? 'Lido' : 'Novo'}</small></div>${!n.read_at ? `<button class="button small" data-action="read-notification" data-id="${h(n.id)}">Marcar como lido</button>` : ''}</article>`).join('') : empty('Você está em dia', 'Configure seu perfil. Novos conteúdos publicados e compatíveis aparecerão aqui.')}</div>`
  );
}
export function privacyRequest() {
  dialog(
    'Solicitação de privacidade',
    `<form data-form="privacy-request" class="stack">${select('kind', 'Tipo de solicitação', ['Acesso', 'Correção', 'Revogação', 'Outro'], 'Acesso', false)}${textarea('body', 'Descreva sua solicitação', '', 'required minlength="5" maxlength="3000"')}<button class="button primary">Enviar solicitação</button></form>`,
  );
}
export async function submitProfile(type, form, v, ctx) {
  if (['login', 'register'].includes(type)) {
    if (type === 'register' && !v.consent)
      throw new Error('Leia e aceite a política de privacidade para criar a conta.');
    const result = await api(`/account/${type}`, {
      method: 'POST',
      body: type === 'register' ? { ...v, consent: true } : v,
    });
    state.user = result.user;
    state.csrf = result.csrf;
    await ctx.refreshAccount();
    await ctx.render();
    toast(type === 'register' ? 'Conta criada. Bem-vindo!' : 'Você entrou na sua conta.');
    return true;
  }
  if (type === 'profile') {
    const p = {
      city: v.city.trim(),
      state: v.state,
      cities: v.cities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      discipline: v.discipline.trim(),
      education: v.education.trim(),
      levels: Object.keys(v)
        .filter((k) => k.startsWith('level:'))
        .map((k) => k.slice(6)),
      radius: Number(v.radius),
      lat: v.lat === '' ? null : Number(v.lat),
      lng: v.lng === '' ? null : Number(v.lng),
    };
    if (p.radius > 0 && (p.lat == null || p.lng == null))
      throw new Error('Informe as coordenadas de referência para usar alertas por raio.');
    const result = await api('/account/profile', {
      method: 'PUT',
      body: {
        name: v.name,
        profile: p,
        preferences: {
          opportunities: !!v.opportunities,
          legislation: !!v.legislation,
          news: !!v.news,
        },
      },
    });
    state.user = result.user;
    await ctx.refreshAccount();
    toast('Perfil e preferências salvos.');
    return true;
  }
  if (type === 'password') {
    await api('/account/password', { method: 'PUT', body: v });
    form.reset();
    toast('Senha alterada. As outras sessões foram encerradas.');
    return true;
  }
  if (type === 'privacy-request') {
    const result = await api('/account/privacy/request', { method: 'POST', body: v });
    document.querySelector('#dialog').close();
    dialog(
      'Solicitação registrada',
      `<p class="muted">Guarde seu protocolo:</p><p class="receipt">${h(result.id)}</p><p class="small-text muted">A equipe responsável acompanhará sua solicitação.</p>`,
    );
    return true;
  }
  if (type === 'delete-account') {
    if (!v.confirm) throw new Error('Confirme a exclusão definitiva.');
    await api('/account/account', { method: 'DELETE', body: { password: v.password } });
    state.user = null;
    state.csrf = null;
    await ctx.refreshAccount();
    await ctx.render();
    toast('Conta e dados pessoais excluídos.');
    return true;
  }
  return false;
}
