import { call, onSubmit, pair, remember, signedIn } from '../account.js';

const connect = document.querySelector('#connect');
const create = document.querySelector('#create');
const list = document.querySelector('#groups');
const forget = document.querySelector('#forget');

function button(text, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'plain';
  element.textContent = text;
  element.addEventListener('click', async () => {
    try {
      await action();
    } catch (error) {
      alert(error.message);
    }
    await show();
  });
  return element;
}

function card({ id, name, code, keeper, members }) {
  const section = document.createElement('section');
  section.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = name;
  section.append(title);

  const link = document.createElement('p');
  const address = document.createElement('a');
  address.href = `../join/#${code}`;
  address.className = 'link';
  address.textContent = code;
  link.append(address);
  if (keeper) link.append(' ', button('Replace code', () => call('POST', `/groups/${id}/code`)));
  section.append(link);

  const people = document.createElement('ul');
  people.className = 'people';
  for (const member of members) {
    const row = document.createElement('li');
    const who = document.createElement('span');
    who.textContent = member.you ? `${member.name} (you)` : member.name;
    row.append(who);
    if (member.you) row.append(button('Leave', () => call('DELETE', `/groups/${id}/members/${member.id}`)));
    else if (keeper) row.append(button('Remove', () => call('DELETE', `/groups/${id}/members/${member.id}`)));
    people.append(row);
  }
  section.append(people);
  return section;
}

async function show() {
  list.replaceChildren();
  if (signedIn()) {
    try {
      const { groups } = await call('GET', '/groups');
      list.append(...groups.map(card));
    } catch (error) {
      connect.querySelector('.problem').textContent = error.message;
    }
  }
  const on = signedIn();
  connect.hidden = on;
  create.hidden = !on;
  forget.hidden = !on;
}

onSubmit(connect, async (data) => {
  await pair(data.get('code').trim());
  connect.reset();
  await show();
});

onSubmit(create, async (data) => {
  await call('POST', '/groups', { name: data.get('name'), member_name: data.get('member_name') });
  create.reset();
  await show();
});

forget.addEventListener('click', async () => {
  await call('DELETE', '/device').catch(() => {});
  remember(null);
  await show();
});

show();
