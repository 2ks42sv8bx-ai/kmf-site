import { call, onSubmit, pair, remember, signedIn } from '../account.js';

const codeForm = document.querySelector('#code-form');
const nameForm = document.querySelector('#name-form');
const heading = document.querySelector('#heading');
let groupCode = '';

async function lookUp(code) {
  const { group } = await call('POST', '/join', { code, dry: true });
  groupCode = code;
  heading.textContent = `Join ${group.name}`;
  codeForm.hidden = true;
  nameForm.hidden = false;
  nameForm.querySelector('#existing').hidden = signedIn();
  nameForm.elements.name.focus();
}

onSubmit(codeForm, (data) => lookUp(data.get('code').trim()));

onSubmit(nameForm, async (data) => {
  const device = data.get('device').trim();
  if (device) await pair(device);
  const wasSignedIn = signedIn();
  const reply = await call('POST', '/join', { code: groupCode, name: data.get('name') });
  if (reply.token) remember(reply.token);
  // Someone with a device is already set up, and wants to see the group.
  location.href = wasSignedIn ? '../groups/' : `../setup/?joined=${encodeURIComponent(reply.group.name)}`;
});

const fromLink = decodeURIComponent(location.hash.slice(1));
if (fromLink) {
  codeForm.elements.code.value = fromLink;
  lookUp(fromLink).catch((error) => {
    codeForm.querySelector('.problem').textContent = error.message;
  });
}
