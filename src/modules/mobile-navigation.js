import { h, icon } from '../ui.js';

const primary = new Map([
  ['direitos', 'Notícias'],
  ['oportunidades', 'Vagas'],
  ['concursos', 'Concursos'],
  ['voz', 'Relatos'],
]);
const mobile = matchMedia('(max-width: 700px)');
let bar, sheet, closing;

async function closeSheet() {
  if (!sheet?.open || closing) return closing;
  closing = (async () => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await sheet
        .animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(24px)' },
          ],
          { duration: 160, easing: 'ease-in' },
        )
        .finished.catch(() => {});
    }
    sheet.close();
    bar.querySelector('button')?.setAttribute('aria-expanded', 'false');
  })();
  await closing;
  closing = null;
}

function install() {
  bar = document.createElement('nav');
  bar.className = 'mobile-navigation';
  bar.setAttribute('aria-label', 'Navegação no celular');
  sheet = document.createElement('dialog');
  sheet.id = 'mobile-navigation-sheet';
  sheet.className = 'mobile-navigation-sheet';
  sheet.setAttribute('aria-labelledby', 'mobile-navigation-title');
  document.body.append(bar, sheet);
  bar.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button || !mobile.matches) return;
    if (closing) await closing;
    if (sheet.open) return;
    sheet.showModal();
    button.setAttribute('aria-expanded', 'true');
  });
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet || event.target.closest('a, button')) closeSheet();
  });
  sheet.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSheet();
  });
  window.addEventListener('hashchange', closeSheet);
  mobile.addEventListener('change', () => {
    if (!mobile.matches) closeSheet();
  });
}

export function renderMobileNavigation(items, area) {
  if (!bar) install();
  const activeArea = ['versoes', 'termos'].includes(area)
    ? 'transparencia'
    : area === 'detalhe'
      ? 'direitos'
      : area;
  const main = items.filter(([key]) => primary.has(key));
  const extra = items.filter(([key]) => !primary.has(key));
  const moreActive = extra.some(([key]) => key === activeArea);
  const link = ([key, label, symbol], compact = false) =>
    `<a href="#/${key}" class="${compact ? 'mobile-nav-item' : 'mobile-sheet-link'} ${key === activeArea ? 'active' : ''}" aria-label="${h(label)}" ${key === activeArea ? 'aria-current="page"' : ''}><span class="mobile-nav-icon">${icon(symbol)}</span><span>${h(compact ? primary.get(key) : label)}</span>${compact ? '' : icon('chevron-right')}</a>`;
  bar.hidden = !items.length;
  document.body.classList.toggle('has-mobile-navigation', !!items.length);
  bar.innerHTML =
    main.map((item) => link(item, true)).join('') +
    (extra.length
      ? `<button type="button" class="mobile-nav-item ${moreActive ? 'active' : ''}" aria-label="Mais áreas" aria-haspopup="dialog" aria-controls="mobile-navigation-sheet" aria-expanded="${sheet.open}"><span class="mobile-nav-icon">${icon('layout-grid')}</span><span>Mais</span></button>`
      : '');
  if (!items.length) closeSheet();
  sheet.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">Voz do Professor</span><h2 id="mobile-navigation-title">Explore mais</h2></div><button type="button" class="icon-button" aria-label="Fechar navegação">${icon('x')}</button></div><nav aria-label="Outras áreas">${extra.map((item) => link(item)).join('')}</nav>`;
}
