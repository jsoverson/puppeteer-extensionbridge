
function getDotProp(context, path) {
  if (path == null || !context) return context;
  let pathParts = Array.isArray(path) ? path : (path + '').split('.');
  let object = context, pathPart;

  while ((pathPart = pathParts.shift()) != null) {
    if (!(pathPart in object)) return {};
    if (pathParts.length === 0) return { object, property: pathPart };
    else object = object[pathPart];
  }
  return { object, property: pathPart };
};

const listenerMap = new Map();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  switch (message.method) {
    case 'getConfig':
      return respond(bridge.getConfig());
    default:
      return respond({ error: 'Method not implemented' });
  }
})

const bridge = {
  _config: {

  },
  getConfig() {
    return { value: [this._config] };
  },
  setConfig(obj) {
    bridge._config = obj;
  },
  async handle(command, argArray) {
    chrome.runtime.sendMessage({ type: 'internal', dir: 'in', what: 'handle', msg: command });
    const { object, property } = getDotProp({ chrome }, command);
    return new Promise((res, rej) => {
      const args = [...argArray, (...args) => {
        chrome.runtime.sendMessage({ type: 'internal', dir: 'out', what: 'handle:response', msg: command });
        return res({ value: args })
      }];
      try {
        object[property](...args);
      } catch (error) {
        chrome.runtime.sendMessage({ type: 'internal', dir: 'out', what: 'handle:Error', msg: command });
        rej(error)
      }
    })
  },
  async addListener(event, functionName) {
    chrome.runtime.sendMessage({ type: 'internal', dir: 'in', what: 'addListener', msg: `event: ${event}, handler: ${functionName}` });
    const { object, property } = getDotProp({ chrome }, event);
    const cb = (...args) => {
      if (typeof window[functionName] === 'function') {
        chrome.runtime.sendMessage({ type: 'internal', dir: 'out', what: 'addListener:callback', msg: `event: ${event}, sending response` });
        window[functionName](...args);
      } else {
        chrome.runtime.sendMessage({ type: 'internal', dir: 'out', what: 'addListener:Error', msg: `event: ${event}: could not find handler: ${functionName}` });
        console.log(`Could not find global function ${functionName} to respond to ${event} event`);
      }
    }
    listenerMap.set(`${event}_${functionName}`, cb);
    object[property].addListener(cb);
  },
  async removeListener(event, functionName) {
    chrome.runtime.sendMessage({ type: 'internal', dir: 'in', what: 'removeListener', msg: `event: ${event}, handler: ${functionName}` });
    const { object, property } = getDotProp({ chrome }, event);
    const cb = listenerMap.get(`${event}_${functionName}`);
    if (cb) object[property].removeListener(cb);
    else console.log(`Could not find callback for "${functionName}" to remove from ${event} event`);
  }
}
