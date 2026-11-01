import { call, onSubmit, remember, showCodeButtons, signedIn } from './account.js';

// Three views on one page: #/ every group, #/ID one group's books, #/ID/BOOK one book's notes.
const view = document.querySelector('#view');

function el(tag, attributes = {}, ...children) {
  const made = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') made.className = value;
    else made.setAttribute(key, value);
  }
  made.append(...children.filter((child) => child !== null && child !== undefined));
  return made;
}

const plural = (count, one) => `${count} ${one}${count === 1 ? '' : 's'}`;
const problemLine = () => el('p', { class: 'problem', role: 'alert' });

function action(text, className, question, run, problem) {
  const button = el('button', { type: 'button', class: className }, text);
  button.addEventListener('click', async () => {
    if (question && !confirm(question)) return;
    try {
      await run();
      await route();
    } catch (error) {
      problem.textContent = error.message;
    }
  });
  return button;
}

function form(id, fields, submit, run) {
  const made = el(
    'form',
    { class: 'card stack', id },
    ...fields.map(([label, name]) =>
      el('label', {}, label, el('input', { name, maxlength: '60', autocomplete: 'off', required: '', ...(label ? {} : { 'aria-label': 'Code from one of your devices', placeholder: 'Code' }) })),
    ),
    el('button', { class: 'primary', type: 'submit' }, submit),
    problemLine(),
  );
  onSubmit(made, run);
  return made;
}

// The front page is already in the HTML, so there's nothing to draw unless it was replaced.
function signedOutView() {
  if (!view.querySelector('.meta')) location.reload();
}

function groupRow(group) {
  const names = group.members.map((member) => member.name).join(', ');
  return el(
    'a',
    { class: 'group-row', href: `#/${group.id}` },
    el('span', { class: 'group-name' }, group.name),
    el('span', { class: 'group-books' }, ...(group.books.length > 0 ? group.books.map((book) => el('span', {}, book.title)) : [el('span', { class: 'muted' }, 'No books yet')])),
    el('span', { class: 'muted group-names' }, names),
  );
}

async function groupsView() {
  const { groups: listed } = await call('GET', '/groups');
  const groups = await Promise.all(
    listed.map(async (group) => ({ ...group, books: (await call('GET', `/groups/${group.id}/library`)).books })),
  );
  const create = form('create', [["Group's name", 'name'], ['Your name in the group', 'member_name']], 'Create', async (data) => {
    await call('POST', '/groups', { name: data.get('name'), member_name: data.get('member_name') });
    await route();
  });
  create.hidden = true;

  const newGroup = el('button', { type: 'button', class: 'primary' }, 'New group');
  newGroup.addEventListener('click', () => {
    create.hidden = !create.hidden;
    if (!create.hidden) create.elements.name.focus();
  });

  const forget = el('button', { type: 'button', class: 'quiet' }, 'Disconnect this browser');
  forget.addEventListener('click', async () => {
    if (!confirm('Disconnect this browser? Your groups and notes stay.')) return;
    await call('DELETE', '/device').catch(() => {});
    remember(null);
    await route();
  });

  view.replaceChildren(
    el('h1', { class: 'unseen' }, 'Reading'),
    el(
      'div',
      { class: 'actions' },
      newGroup,
      el('a', { class: 'button', href: 'join/' }, 'Join a group'),
    ),
    create,
    groups.length > 0 ? el('div', { class: 'group-list' }, ...groups.map(groupRow)) : el('p', { class: 'muted' }, 'No groups yet.'),
    el(
      'footer',
      { class: 'quiet-footer' },
      el('div', { class: 'code-line' }, el('button', { type: 'button', class: 'quiet get-code' }, 'Code for another device'), el('strong', { class: 'code' })),
      forget,
    ),
  );
  showCodeButtons();
}

function versionLine(versions) {
  if (versions.length > 1) return `${versions.length} different copies`;
  return versions[0]?.length > 1 ? 'Same copy' : null;
}

function bookRow(group, book) {
  const readers = [...new Set(book.notes.map((note) => (note.you ? 'You' : note.name)))].join(', ');
  return el(
    'a',
    { class: 'book-row', href: `#/${group.id}/${book.id}` },
    el('span', { class: 'book-title' }, book.title),
    book.author ? el('span', { class: 'muted' }, book.author) : null,
    el(
      'span',
      { class: 'book-meta' },
      book.notes.length > 0 ? [readers, plural(book.notes.length, 'shared passage'), versionLine(book.versions)].filter(Boolean).join(' · ') : 'Nothing shared yet',
    ),
  );
}

function membersPanel(group) {
  const problem = problemLine();
  const copy = el('button', { type: 'button', class: 'secondary' }, 'Copy invite link');
  copy.addEventListener('click', async () => {
    const link = new URL(`join/#${group.code}`, location.href).href;
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = 'Copied';
    } catch {
      prompt('Invite link', link);
    }
  });
  const you = group.members.find((member) => member.you);
  return el(
    'section',
    { class: 'panel-card' },
    el('header', { class: 'panel-head' }, el('h2', {}, plural(group.members.length, 'member'))),
    el(
      'ul',
      { class: 'people' },
      ...group.members.map((member) =>
        el(
          'li',
          {},
          el('span', {}, member.you ? `${member.name} (you)` : member.name),
          group.keeper && !member.you
            ? action('Remove', 'quiet', `Remove ${member.name} from ${group.name}?`, () => call('DELETE', `/groups/${group.id}/members/${member.id}`), problem)
            : null,
        ),
      ),
    ),
    el(
      'div',
      { class: 'invite' },
      el('span', { class: 'invite-code' }, group.code),
      copy,
      group.keeper
        ? action('Replace code', 'quiet', `Replace the code for ${group.name}? The old code and link stop working.`, () => call('POST', `/groups/${group.id}/code`), problem)
        : null,
    ),
    action(
      'Leave group',
      'quiet',
      group.members.length === 1 ? `Leave ${group.name}? You're its only member, so the group ends.` : `Leave ${group.name}?`,
      async () => {
        await call('DELETE', `/groups/${group.id}/members/${you.id}`);
        location.hash = '#/';
      },
      problem,
    ),
    problem,
  );
}

async function findGroup(id) {
  const { groups } = await call('GET', '/groups');
  return groups.find((group) => String(group.id) === id);
}

function booksPanel(group, books) {
  const problem = problemLine();
  const picker = el('ul', { class: 'book-picker' });
  picker.hidden = true;
  const add = el('button', { type: 'button' }, 'Add a book');
  add.addEventListener('click', async () => {
    if (!picker.hidden) {
      picker.hidden = true;
      return;
    }
    try {
      const { books: mine } = await call('GET', '/books');
      const added = new Set(books.map((book) => book.id));
      const available = mine.filter((book) => !added.has(book.id));
      picker.replaceChildren(
        ...(available.length > 0
          ? available.map((book) =>
              el('li', {}, action(book.title, 'quiet', null, () => call('POST', `/groups/${group.id}/books`, { book: book.id }), problem)),
            )
          : [el('li', { class: 'muted' }, 'No more books to add')]),
      );
      picker.hidden = false;
    } catch (error) {
      problem.textContent = error.message;
    }
  });
  return el(
    'section',
    { class: 'panel-card' },
    el('header', { class: 'panel-head' }, el('h2', {}, 'Books'), add),
    picker,
    problem,
    books.length > 0 ? el('div', { class: 'book-list' }, ...books.map((book) => bookRow(group, book))) : el('p', { class: 'muted' }, 'No books yet'),
  );
}

async function groupView(id) {
  const group = await findGroup(id);
  if (!group) {
    location.hash = '#/';
    return;
  }
  const { books } = await call('GET', `/groups/${id}/library`);
  view.replaceChildren(
    el('h1', {}, group.name),
    el('div', { class: 'panels' }, booksPanel(group, books), membersPanel(group)),
  );
}

function versionsPanel(book) {
  if (book.versions.length === 0 || (book.versions.length === 1 && book.versions[0].length === 1)) return null;
  const names = (version) => version.map((holder) => (holder.you ? 'You' : holder.name)).join(', ');
  return el(
    'section',
    { class: 'versions' },
    el('h2', {}, book.versions.length === 1 ? 'Everyone has the same copy' : `${book.versions.length} different copies`),
    book.versions.length === 1
      ? el('p', { class: 'muted' }, names(book.versions[0]))
      : el('ul', { class: 'version-list' }, ...book.versions.map((version, i) => el('li', {}, el('span', { class: 'muted' }, `Copy ${i + 1}`), ` ${names(version)}`))),
  );
}

async function bookView(groupId, bookId) {
  const group = await findGroup(groupId);
  const { books } = group ? await call('GET', `/groups/${groupId}/library`) : { books: [] };
  const book = books.find((candidate) => candidate.id === bookId);
  if (!book) {
    location.hash = `#/${groupId}`;
    return;
  }
  const parts = [];
  let chapter;
  for (const note of book.notes) {
    if (note.chapter && note.chapter !== chapter) {
      chapter = note.chapter;
      parts.push(el('h2', { class: 'chapter' }, chapter));
    }
    parts.push(
      el(
        'article',
        { class: 'passage' },
        el('blockquote', {}, note.quote),
        note.note ? el('p', {}, note.note) : null,
        el('p', { class: 'muted' }, [note.you ? 'You' : note.name, note.page ? `p. ${note.page}` : null].filter(Boolean).join(' · ')),
      ),
    );
  }
  view.replaceChildren(
    el('a', { class: 'back', href: `#/${groupId}` }, group.name),
    el('h1', {}, book.title),
    book.author ? el('p', { class: 'subtitle muted' }, book.author) : null,
    group.keeper
      ? action('Remove from group', 'quiet', `Remove ${book.title} from ${group.name}? Everyone keeps their own notes.`, async () => {
          await call('DELETE', `/groups/${groupId}/books/${book.id}`);
          location.hash = `#/${groupId}`;
        }, el('p'))
      : null,
    versionsPanel(book),
    el('div', { class: 'passages' }, ...parts),
  );
}

async function route() {
  if (!signedIn()) {
    signedOutView();
    return;
  }
  view.className = 'page';
  const [groupId, bookId] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (bookId) await bookView(groupId, bookId);
    else if (groupId) await groupView(groupId);
    else await groupsView();
  } catch (error) {
    if (!signedIn()) signedOutView();
    else view.replaceChildren(el('p', { class: 'problem', role: 'alert' }, error.message));
  }
  scrollTo(0, 0);
}

addEventListener('hashchange', route);
route();
