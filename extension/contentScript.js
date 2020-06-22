
window.addEventListener('message', (evt) => {
  const data = evt.data;
  if (!data || data.type !== 'extensionbridge') return;
  switch (data.type) {
  }
  // chrome.runtime.sendMessage()
})