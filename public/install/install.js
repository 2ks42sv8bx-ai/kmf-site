import { showCodeButtons, signedIn } from '../account.js';

const tiles = document.querySelectorAll('.tile');
const variants = document.querySelectorAll('[data-for]');
const cards = [...document.querySelectorAll('.step-card')];
const progress = document.querySelector('#progress');
const back = document.querySelector('#back');
const next = document.querySelector('#next');
let at = 0;

function show() {
  cards.forEach((card, i) => {
    card.hidden = i !== at;
  });
  progress.textContent = `Step ${at + 1} of ${cards.length}`;
  back.hidden = at === 0;
  next.hidden = at === cards.length - 1;
}

for (const tile of tiles) {
  tile.addEventListener('click', () => {
    for (const other of tiles) other.setAttribute('aria-pressed', String(other === tile));
    for (const variant of variants) variant.hidden = variant.dataset.for !== tile.dataset.device;
  });
}
back.addEventListener('click', () => {
  at -= 1;
  show();
});
next.addEventListener('click', () => {
  at += 1;
  show();
});

const joined = new URLSearchParams(location.search).get('joined');
if (joined) {
  const notice = document.querySelector('#joined');
  notice.textContent = `You've joined ${joined}.`;
  notice.hidden = false;
  history.replaceState(null, '', location.pathname);
}

const on = signedIn();
for (const part of document.querySelectorAll('[data-signed-in]')) part.hidden = !on;
for (const part of document.querySelectorAll('[data-signed-out]')) part.hidden = on;
showCodeButtons();
show();
