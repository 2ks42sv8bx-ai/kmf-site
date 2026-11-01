import { showCodeButtons, signedIn } from '../account.js';

const joined = new URLSearchParams(location.search).get('joined');
if (joined) {
  const notice = document.querySelector('#joined');
  notice.textContent = `You've joined ${joined}.`;
  notice.hidden = false;
  history.replaceState(null, '', location.pathname);
}

const on = signedIn();
for (const part of document.querySelectorAll('[data-signed-in]')) part.hidden = !on;
showCodeButtons();
