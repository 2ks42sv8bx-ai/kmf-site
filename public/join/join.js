import { call, onSubmit, pair, remember, signedIn } from '../account.js';

const codeForm = document.querySelector('#code-form');
const nameForm = document.querySelector('#name-form');
const setup = document.querySelector('#setup');
const heading = document.querySelector('#heading');
let groupCode = '';

async function lookUp(code) {
  const { group } = await call('POST', '/join', { code, dry: true });
  groupCode = code;
  heading.textContent = group.name;
  codeForm.hidden = true;
  nameForm.hidden = false;
  nameForm.querySelector('#existing').hidden = signedIn();
  nameForm.elements.name.focus();
}

onSubmit(codeForm, (data) => lookUp(data.get('code').trim()));

onSubmit(nameForm, async (data) => {
  const device = data.get('device').trim();
  if (device) await pair(device);
  const reply = await call('POST', '/join', { code: groupCode, name: data.get('name') });
  if (reply.token) remember(reply.token);
  history.replaceState(null, '', location.pathname);
  nameForm.hidden = true;
  setup.hidden = false;
});

for (const button of document.querySelectorAll('.get-code')) {
  const shown = button.parentElement.querySelector('.code');
  button.addEventListener('click', async () => {
    try {
      shown.textContent = (await call('POST', '/codes')).code;
    } catch (error) {
      shown.textContent = error.message;
    }
  });
}

const fromLink = decodeURIComponent(location.hash.slice(1));
if (fromLink) {
  codeForm.elements.code.value = fromLink;
  lookUp(fromLink).catch((error) => {
    codeForm.querySelector('.problem').textContent = error.message;
  });
}
