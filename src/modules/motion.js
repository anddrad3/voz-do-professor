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
