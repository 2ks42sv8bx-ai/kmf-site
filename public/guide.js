const buttons = document.querySelectorAll('.seg-btn');
const steps = document.querySelectorAll('[data-for]');

for (const button of buttons) {
  button.addEventListener('click', () => {
    for (const other of buttons) {
      const on = other === button;
      other.classList.toggle('seg-on', on);
      other.setAttribute('aria-pressed', String(on));
    }
    for (const step of steps) {
      step.hidden = step.dataset.for !== button.dataset.device;
    }
  });
}
