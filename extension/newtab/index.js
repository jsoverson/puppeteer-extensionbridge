
chrome.runtime.sendMessage({ method: 'getConfig' }, function (response) {
  const config = response.value[0];
  if (config && config.newtab) {
    window.location = config.newtab;
  }
})
