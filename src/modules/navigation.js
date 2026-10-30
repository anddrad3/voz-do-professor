import { icon } from '../ui.js';
const rails = new Map();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer = new ResizeObserver(() => rails.forEach(({ update }) => update()));

function rail(node) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-rail';
  const label = node.classList.contains('navigation') ? 'menu' : 'categorias';
  let cycle = 0,
    frame = 0,
    measuredWidth = -1,
    originals = [];
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const normalize = () => {
    if (!cycle) return;
    // Two spare copies on each side keep touch, wheel and arrows continuous.
    if (node.scrollLeft < cycle) node.scrollLeft += cycle;
    else if (node.scrollLeft >= cycle * 3) node.scrollLeft -= cycle;
  };
  const move = (distance) => {
    stop();
    if (reduced()) {
      node.scrollLeft += distance;
      normalize();
      return;
    }
    let start,
      previous = 0;
    const tick = (time) => {
      start ??= time;
      const progress = Math.min(1, (time - start) / 340);
      const eased = 1 - (1 - progress) ** 3;
      node.scrollLeft += distance * (eased - previous);
      previous = eased;
      normalize();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    frame = requestAnimationFrame(tick);
  };
  const buttons = [-1, 1].map((direction) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button nav-arrow';
    button.setAttribute(
      'aria-label',
      `Rolar ${label} para a ${direction < 0 ? 'esquerda' : 'direita'}`,
    );
    button.innerHTML = icon(direction < 0 ? 'chevron-left' : 'chevron-right');
    button.addEventListener('click', () => move(direction * Math.max(120, node.clientWidth * 0.7)));
    return button;
  });
  node.before(wrapper);
  wrapper.append(buttons[0], node, buttons[1]);
  const clone = (item) => {
    const copy = item.cloneNode(true);
    copy.dataset.loopClone = 'true';
    copy.setAttribute('aria-hidden', 'true');
    copy.removeAttribute('aria-current');
    // Duplicate visuals remain clickable but do not repeat keyboard/screen-reader navigation.
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      element.removeAttribute('id');
      if (element.matches('a, button, input, [tabindex]')) element.tabIndex = -1;
    }
    return copy;
  };
  const update = (force = false) => {
    wrapper.hidden = node.hidden || !node.children.length;
    if (wrapper.hidden || !node.isConnected) return;
    const width = wrapper.clientWidth;
    const current = [...node.children].filter((el) => !el.dataset.loopClone);
    if (
      !force &&
      measuredWidth === width &&
      current.length === originals.length &&
      current.every((el, i) => el === originals[i])
    )
      return;
    stop();
    node.querySelectorAll('[data-loop-clone]').forEach((el) => el.remove());
    originals = current;
    cycle = 0;
    measuredWidth = width;
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    const natural =
      originals.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) +
      gap * Math.max(0, originals.length - 1);
    const overflow = natural > width + 2;
    wrapper.dataset.overflow = String(overflow);
    node.scrollLeft = 0;
    if (overflow && originals.length > 1) {
      cycle = natural + gap;
      node.prepend(...[...originals, ...originals].map(clone));
      node.append(...[...originals, ...originals].map(clone));
      node.scrollLeft = cycle * 2;
    }
    const active = originals.find((el) => el.matches('.active, [aria-current="page"]'));
    if (active) {
      const box = node.getBoundingClientRect(),
        item = active.getBoundingClientRect();
      if (item.right > box.right) node.scrollLeft += item.right - box.right + 8;
      else if (item.left < box.left) node.scrollLeft += item.left - box.left - 8;
    }
  };
  node.addEventListener('scroll', normalize, { passive: true });
  node.addEventListener('wheel', stop, { passive: true });
  node.addEventListener('pointerdown', stop, { passive: true });
  observer.observe(wrapper);
  return { wrapper, update, stop };
}

export function enhanceNavigation(root = document) {
  for (const [node, entry] of rails) {
    if (!node.isConnected) {
      entry.stop();
      observer.unobserve(entry.wrapper);
      rails.delete(node);
    }
  }
  root.querySelectorAll('.navigation, .tabs').forEach((node) => {
    if (!rails.has(node)) rails.set(node, rail(node));
    rails.get(node).update(true);
  });
}

export async function toggleMenu(node, button) {
  const entry = rails.get(node),
    wrapper = entry?.wrapper || node;
  const opening = node.hidden;
  button.disabled = true;
  if (opening) {
    node.hidden = false;
    wrapper.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    entry?.update(true);
  }
  if (!reduced()) {
    await wrapper
      .animate(
        opening
          ? [
              { opacity: 0, transform: 'translateX(-8px)' },
              { opacity: 1, transform: 'translateX(0)' },
            ]
          : [
              { opacity: 1, transform: 'translateX(0)' },
              { opacity: 0, transform: 'translateX(-8px)' },
            ],
        { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' },
      )
      .finished.catch(() => {});
  }
  node.hidden = !opening;
  wrapper.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  button.setAttribute('aria-label', opening ? 'Recolher menu' : 'Expandir menu');
  button.disabled = false;
  entry?.update(true);
}
