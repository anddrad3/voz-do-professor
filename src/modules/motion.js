export function animateContent(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.getAnimations().forEach((animation) => animation.cancel());
  root.animate(
    [
      { opacity: 0.3, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  [...root.querySelectorAll('.masonry > .card, .grid > .card')]
    .filter((card) => card.getBoundingClientRect().top < innerHeight)
    .slice(0, 12)
    .forEach((card, index) => {
      card.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: 380,
          delay: Math.min(index * 35, 210),
          fill: 'backwards',
          easing: 'cubic-bezier(.16,1,.3,1)',
        },
      );
    });
}
export function installMotion() {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', (event) => {
    const target = event.target.closest('button:not(:disabled), a.button, .chip, summary');
    if (!target || reduced()) return;
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' },
    );
  });
  document.addEventListener(
    'toggle',
    (event) => {
      if (event.target.tagName !== 'DETAILS' || !event.target.open || reduced()) return;
      event.target.animate(
        [
          { opacity: 0.5, transform: 'translateY(-3px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    },
    true,
  );
}
