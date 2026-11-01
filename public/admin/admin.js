import { SERVER, onSubmit } from '../account.js';

// The secret is held here and nowhere else, so closing the page locks it again.
let secret = '';

const panel = document.querySelector('#panel');
const problem = document.querySelector('#problem');

async function admin(method, path, body) {
  let response;
  try {
    response = await fetch(`${SERVER}/admin${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Can't reach the server.");
  }
  if (response.status === 401) throw new Error("That secret doesn't work.");
  if (!response.ok) throw new Error('Something went wrong.');
  return response.json();
}

function el(tag, attributes = {}, ...children) {
  const made = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) made.setAttribute(key, value);
  made.append(...children.filter((child) => child !== null && child !== undefined));
  return made;
}

function action(text, question, run) {
  const button = el('button', { type: 'button', class: 'quiet' }, text);
  button.addEventListener('click', async () => {
    if (question && !confirm(question)) return;
    problem.textContent = '';
    try {
      await run();
      await show();
    } catch (error) {
      problem.textContent = error.message;
    }
  });
  return button;
}

function copyButton(text) {
  const button = el('button', { type: 'button', class: 'secondary' }, 'Copy link');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      prompt('Link', text);
    }
  });
  return button;
}

const date = (at) => new Date(at).toLocaleDateString();
const joinPage = new URL('../join/', location.href).href;

function accountName(account) {
  return account.names.length > 0 ? account.names.join(', ') : `Account ${account.id}`;
}

function groupCard(group) {
  return el(
    'section',
    { class: 'card admin-group' },
    el('h3', {}, group.name),
    el(
      'p',
      {},
      el('strong', { class: 'code' }, group.code),
      ' ',
      copyButton(`${joinPage}#${group.code}`),
      ' ',
      action('Replace code', `Replace the code for ${group.name}? The old code and link stop working.`, () =>
        admin('POST', `/groups/${group.id}/code`),
      ),
    ),
    el(
      'ul',
      {},
      ...group.members.map((member) =>
        el(
          'li',
          {},
          `${member.name} `,
          action('Remove', `Remove ${member.name} from ${group.name}?`, () =>
            admin('DELETE', `/groups/${group.id}/members/${member.id}`),
          ),
        ),
      ),
    ),
  );
}

function personRow(account) {
  return el(
    'li',
    {},
    `${accountName(account)}: joined ${date(account.created_at)}, ${account.books} book${account.books === 1 ? '' : 's'}`,
    el(
      'ul',
      {},
      ...account.devices.map((device) =>
        el(
          'li',
          {},
          `Device connected ${date(device.created_at)} `,
          action('Disconnect', 'Disconnect this device? It keeps its notes, and needs a new code to sync again.', () =>
            admin('DELETE', `/devices/${device.id}`),
          ),
        ),
      ),
    ),
  );
}

async function show() {
  const { invites, groups, accounts } = await admin('GET', '/overview');
  document.querySelector('#invites').replaceChildren(
    ...invites.map((invite) =>
      el(
        'li',
        {},
        el('strong', { class: 'code' }, invite.code),
        ` until ${date(invite.expires_at)} `,
        action('Cancel', `Cancel invite ${invite.code}?`, () => admin('DELETE', `/invites/${invite.code}`)),
      ),
    ),
  );
  document.querySelector('#accounts').replaceChildren(
    ...accounts.map((account) => el('option', { value: String(account.id) }, accountName(account))),
  );
  document.querySelector('#groups').replaceChildren(...groups.map(groupCard));
  document.querySelector('#people').replaceChildren(...accounts.map(personRow));
}

onSubmit(document.querySelector('#unlock'), async (data) => {
  secret = data.get('secret');
  await show();
  document.querySelector('#unlock').hidden = true;
  panel.hidden = false;
});

document.querySelector('#new-invite').addEventListener('click', async () => {
  problem.textContent = '';
  try {
    await admin('POST', '/invites');
    await show();
  } catch (error) {
    problem.textContent = error.message;
  }
});

onSubmit(document.querySelector('#new-group'), async (data) => {
  await admin('POST', '/groups', {
    name: data.get('name'),
    member_name: data.get('member_name'),
    account: Number(data.get('account')),
  });
  document.querySelector('#new-group').reset();
  await show();
});
