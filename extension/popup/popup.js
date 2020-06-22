
window.addEventListener('load', () => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const eventsEl = document.querySelector('#events');
    console.log({ request, sender });
    if (request.type === 'internal') {
      const listItem = document.createElement('li');
      listItem.innerHTML = `<span class="event-dir">${request.dir === 'in' ? '<img src="./right-arrow.svg"><img src="./right-arrow.svg">' : '<img src="./left-arrow.svg"><img src="./left-arrow.svg">'}</span><span class="event-what">${request.what}</span><span class="event-msg">${request.msg}</span>`
      eventsEl.prepend(listItem);
    }
  })
})