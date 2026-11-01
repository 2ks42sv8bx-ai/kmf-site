import { onSubmit, pair, showCodeButtons, signedIn } from '../account.js';

const cards = [...document.querySelectorAll('article.step-card')];
const login = document.querySelector('#login');
const progress = document.querySelector('#progress');
const back = document.querySelector('#back');
const next = document.querySelector('#next');
const done = document.querySelector('#done');
const logIn = document.querySelector('#log-in');

// The steps, then the log-in card for anyone not connected yet. A connected reader just finishes.
const on = signedIn();
const lastStep = cards.length - 1;
const loginAt = cards.length;
let at = !on && location.hash === '#login' ? loginAt : 0;

function show() {
  const onLogin = at === loginAt;
  cards.forEach((card, i) => {
    card.hidden = i !== at;
  });
  login.hidden = !onLogin;
  progress.hidden = onLogin;
  progress.textContent = `Step ${at + 1} of ${cards.length}`;
  back.hidden = at === 0;
  logIn.hidden = !onLogin;
  done.hidden = !(on && at === lastStep);
  next.hidden = onLogin || (on && at === lastStep);
  if (onLogin) login.elements.code.focus({ preventScroll: true });
}

back.addEventListener('click', () => {
  at -= 1;
  show();
});
next.addEventListener('click', () => {
  at += 1;
  show();
});

onSubmit(login, async (data) => {
  await pair(data.get('code').trim());
  location.href = '../';
});

const joined = new URLSearchParams(location.search).get('joined');
if (joined) {
  const notice = document.querySelector('#joined');
  notice.textContent = `You've joined ${joined}.`;
  notice.hidden = false;
  history.replaceState(null, '', location.pathname);
}

for (const part of document.querySelectorAll('[data-signed-in]')) part.hidden = !on;
showCodeButtons();
show();
