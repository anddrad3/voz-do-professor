import { icon } from '../ui.js';
const rails = new Map();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer = new ResizeObserver(() => rails.forEach(({ update }) => update()));

export function enhanceNavigation(root = document) {
  for (const [node] of rails) {
    if (!node.isConnected) {
      observer.unobserve(node);
      rails.delete(node);
    }
  }
  root.querySelectorAll('.navigation, .tabs').forEach((node) => {
    if (!rails.has(node)) {
      const wrapper = document.createElement('div');
      wrapper.className = 'nav-rail';
      const label = node.classList.contains('navigation') ? 'menu' : 'categorias';
      const buttons = [-1, 1].map((direction) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-button nav-arrow';
        button.setAttribute(
          'aria-label',
          `Rolar ${label} para a ${direction < 0 ? 'esquerda' : 'direita'}`,
        );
        button.innerHTML = icon(direction < 0 ? 'chevron-left' : 'chevron-right');
        button.addEventListener('click', () =>
          node.scrollBy({
            left: direction * Math.max(160, node.clientWidth * 0.7),
            behavior: reduced() ? 'instant' : 'smooth',
          }),
        );
        return button;
      });
      node.before(wrapper);
      wrapper.append(buttons[0], node, buttons[1]);
      const update = () => {
        wrapper.hidden = node.hidden || !node.children.length;
        const max = node.scrollWidth - node.clientWidth;
        wrapper.dataset.overflow = String(max > 2);
        buttons[0].disabled = node.scrollLeft < 2;
        buttons[1].disabled = node.scrollLeft >= max - 2;
      };
      node.addEventListener('scroll', update, { passive: true });
      rails.set(node, { update, wrapper });
      observer.observe(node);
    }
    const { update } = rails.get(node);
    update();
    requestAnimationFrame(() => {
      const active = node.querySelector('.active, [aria-current="page"]');
      if (active && !node.hidden) {
        const box = node.getBoundingClientRect(),
          item = active.getBoundingClientRect();
        const distance =
          item.right > box.right
            ? item.right - box.right + 8
            : item.left < box.left
              ? item.left - box.left - 8
              : 0;
        if (distance) node.scrollBy({ left: distance, behavior: reduced() ? 'instant' : 'smooth' });
      }
      update();
    });
  });
}

export async function toggleMenu(node, button) {
  const wrapper = rails.get(node)?.wrapper || node;
  const opening = node.hidden;
  button.disabled = true;
  if (opening) {
    node.hidden = false;
    wrapper.hidden = false;
  }
  const height = wrapper.getBoundingClientRect().height;
  if (!reduced()) {
    wrapper.style.overflow = 'hidden';
    await wrapper
      .animate(
        opening
          ? [
              { height: '0px', opacity: 0 },
              { height: `${height}px`, opacity: 1 },
            ]
          : [
              { height: `${height}px`, opacity: 1 },
              { height: '0px', opacity: 0 },
            ],
        { duration: 250, easing: 'cubic-bezier(.2,.7,.2,1)' },
      )
      .finished.catch(() => {});
    wrapper.style.overflow = '';
  }
  node.hidden = !opening;
  wrapper.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  button.setAttribute('aria-label', opening ? 'Recolher menu' : 'Expandir menu');
  button.disabled = false;
  rails.get(node)?.update();
}
