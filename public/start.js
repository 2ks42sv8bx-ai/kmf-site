import { call, onSubmit, pair, remember, showCodeButtons, signedIn } from './account.js';

const codeForm = document.querySelector('#code-form');
const nameForm = document.querySelector('#name-form');
const tiles = document.querySelectorAll('.tile');
let groupCode = '';

for (const tile of tiles) {
  tile.addEventListener('click', () => {
    for (const other of tiles) other.setAttribute('aria-pressed', String(other === tile));
    for (const part of document.querySelectorAll('[data-for]')) part.hidden = part.dataset.for !== tile.dataset.device;
  });
}

function showConnected() {
  const on = signedIn();
  for (const part of document.querySelectorAll('[data-signed-in]')) part.hidden = !on;
  for (const part of document.querySelectorAll('[data-signed-out]')) part.hidden = on;
}

async function lookUp(code) {
  const { group } = await call('POST', '/join', { code, dry: true });
  groupCode = code;
  document.querySelector('#group-name').textContent = group.name;
  codeForm.hidden = true;
  nameForm.hidden = false;
  nameForm.querySelector('#existing').hidden = signedIn();
  nameForm.elements.name.focus();
}

onSubmit(codeForm, (data) => lookUp(data.get('code').trim()));

onSubmit(nameForm, async (data) => {
  const existing = data.get('device').trim();
  if (existing) await pair(existing);
  const reply = await call('POST', '/join', { code: groupCode, name: data.get('name') });
  if (reply.token) remember(reply.token);
  history.replaceState(null, '', location.pathname);
  nameForm.hidden = true;
  codeForm.hidden = true;
  const joined = document.querySelector('#joined');
  joined.textContent = `You've joined ${reply.group.name}.`;
  joined.hidden = false;
  showConnected();
});

const fromLink = decodeURIComponent(location.hash.slice(1));
if (fromLink) {
  codeForm.elements.code.value = fromLink;
  lookUp(fromLink).catch((error) => {
    codeForm.querySelector('.problem').textContent = error.message;
  });
}

showConnected();
showCodeButtons();
