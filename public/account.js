// The server, and this browser's place on it. The site is one more device.
export const SERVER = location.hostname === 'localhost' ? 'http://localhost:8766/v1' : 'https://sync.vandenhove.page/v1';
const KEY = 'vandenhove-token';

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Without storage the page still works until it's closed.
let session = stored();

function showConnected() {
  for (const part of document.querySelectorAll('[data-connected]')) part.hidden = !session;
}

export function remember(value) {
  session = value;
  showConnected();
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Kept in `session` alone.
  }
}

const MESSAGES = {
  wrong_code: "That code doesn't work.",
  try_later: 'Too many tries. Try again later.',
  no_name: 'Enter a name.',
  not_keeper: 'Only the first member can do that.',
  not_signed_in: 'This browser has been disconnected.',
};

export async function call(method, path, body) {
  let response;
  try {
    response = await fetch(`${SERVER}${path}`, {
      method,
      headers: {
        ...(session ? { Authorization: `Bearer ${session}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Can't reach the server.");
  }
  const reply = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (reply.error === 'not_signed_in') remember(null);
    throw new Error(MESSAGES[reply.error] ?? 'Something went wrong.');
  }
  return reply;
}

export const signedIn = () => Boolean(session);

/** Connect this browser to an account, with a code from a device already on it. */
export async function pair(code) {
  const { token } = await call('POST', '/pair', { code });
  remember(token);
}

/** Run a form's action, showing what went wrong beside it. */
export function onSubmit(form, action) {
  const problem = form.querySelector('.problem');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    problem.textContent = '';
    try {
      await action(new FormData(form));
    } catch (error) {
      problem.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

/** Buttons that show a new code for another device beside them. */
export function showCodeButtons() {
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
}

showConnected();
