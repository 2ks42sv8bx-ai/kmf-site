document.querySelector('#enter').addEventListener('submit', (event) => {
  event.preventDefault();
  location.href = `join/#${encodeURIComponent(event.target.elements.code.value.trim())}`;
});
