import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';
import { ConsoleMessage } from 'puppeteer/lib/cjs/puppeteer/common/ConsoleMessage';
import path from 'path';
import findRoot from 'find-root';
import DEBUG from 'debug';
import { Browser } from 'puppeteer/lib/cjs/puppeteer/common/Browser';
import { CDPSession, Connection } from 'puppeteer/lib/cjs/puppeteer/common/Connection';
import { Target } from 'puppeteer/lib/cjs/puppeteer/common/Target';
import { BrowserOptions, LaunchOptions, ChromeArgOptions } from 'puppeteer/lib/cjs/puppeteer/node/LaunchOptions';

type PuppeteerLaunchOptions = LaunchOptions & BrowserOptions & ChromeArgOptions;

const debug = DEBUG('puppeteer:extensionbridge');

export interface BrowserExtensionBridge {
  extension: ExtensionBridge;
}

export interface PluginConfig {
  newtab?: string;
}

export interface BridgeResponse {
  value: any[];
  error?: Error;
}

const extensionId = require(path.join(findRoot(__dirname), 'extension', 'manifest.json')).key;

export class ExtensionBridge {
  page?: Page;
  private exposedFunctionIndex = 0;
  private exposedFunctionMap = new WeakMap<Function, string>();
  private exposedFunctionPrefix = 'extensionBridge_';

  constructor(page?: Page) {
    if (!page) debug('ExtensionBridge instantiated with invalid page object');
    else {
      this.page = page;
      page.on('console', async (consoleMessage: ConsoleMessage) => {
        debug(consoleMessage.args());
      });
    }
  }

  private async sendMessage(expression: string): Promise<BridgeResponse> {
    if (!this.page) throw new Error('puppeteer-extensionbridge does not have access to a valid Page object');
    const session = await this.page.target().createCDPSession();
    const context = await this.page.mainFrame().executionContext();
    try {
      const message = {
        expression: expression,
        // @ts-ignore I effing hate private fields.
        contextId: context._contextId,
        returnByValue: true,
        userGesture: true,
        awaitPromise: true,
        matchAboutBlank: true,
      };
      debug('sending message to extension %o', message);
      const rv = (await session.send('Runtime.evaluate', message)) as { result: { value: any } };
      return rv.result.value as any;
    } catch (e) {
      debug('ExtensionBridge: send failed %o', e.message);
      throw e;
    }
  }

  getConfig() {
    debug(`extensionBridge.getConfig()`);
    return this.sendMessage(`bridge.getConfig()`).then((response: BridgeResponse) => response.value[0]);
  }
  setConfig(obj: any) {
    debug(`extensionBridge.setConfig({...})`);
    let json = '';
    try {
      json = JSON.stringify(obj);
    } catch (e) {
      console.log(`puppeteer-extensionbridge could not stringify payload for ${obj}.`);
      throw e;
    }
    return this.sendMessage(`bridge.setConfig(${json})`);
  }
  send(endpoint: string, ...payload: any): Promise<BridgeResponse> {
    debug(`extensionBridge.send(${endpoint}, ...)`);
    let json = '';
    try {
      json = JSON.stringify(payload);
    } catch (e) {
      console.log(`puppeteer-extensionbridge could not stringify payload ${payload}.`);
      throw e;
    }
    return this.sendMessage(`bridge.handle("${endpoint}", ${json})`);
  }
  async addListener(event: string, cb: (...args: any[]) => any) {
    debug(`extensionBridge.addListener(${event}, ...)`);

    const fnName = this.exposedFunctionPrefix + this.exposedFunctionIndex++;
    this.exposedFunctionMap.set(cb, fnName);
    if (!this.page) throw new Error('puppeteer-extensionbridge does not have access to a valid Page object');
    await this.page.exposeFunction(fnName, cb);

    return this.sendMessage(`bridge.addListener("${event}", "${fnName}")`);
  }
  async removeListener(event: string, cb: (...args: any[]) => any) {
    debug(`extensionBridge.addListener(${event}, ...)`);
    const fnName = this.exposedFunctionMap.get(cb);
    return this.sendMessage(`bridge.removeListener("${event}", "${fnName}")`);
  }
}

export class NullExtensionBridge extends ExtensionBridge {
  async getConfig(): Promise<any> {}
  async setConfig() {
    return { value: [] };
  }
  async send() {
    return { value: [] };
  }
  async addListener() {
    return { value: [] };
  }
  async removeListener() {
    return { value: [] };
  }
}

export function mergeLaunchOptions(options: PuppeteerLaunchOptions) {
  const extensionPath = path.join(findRoot(__dirname), 'extension');
  if (!('headless' in options) || options.headless) {
    // Throw on this, adding it magically causes confusion.
    throw new Error(
      "puppeteer-extensionbridge has to run in GUI (non-headless) mode. Add `headless:false` puppeteer's launch options",
    );
  }
  if (options.ignoreDefaultArgs) {
    if (Array.isArray(options.ignoreDefaultArgs)) {
      const ignoreArg_disableExtensions = options.ignoreDefaultArgs.includes('--disable-extensions');
      if (!ignoreArg_disableExtensions) {
        debug('Adding --disable-extensions to ignoreDefaultArgs');
        options.ignoreDefaultArgs.push('--disable-extensions');
      }
    }
  } else {
    debug('Setting ignoreDefaultArgs to ["--disable-extensions"]');
    options.ignoreDefaultArgs = [`--disable-extensions`];
  }

  if (options.args) {
    const loadExtensionIndex = options.args.findIndex((a: string) => a.startsWith('--load-extension'));
    if (loadExtensionIndex > -1) {
      debug(`Appending ${extensionPath} to --load-extension arg`);
      options.args[loadExtensionIndex] += `,${extensionPath}`;
    } else {
      debug(`Adding arg '--load-extension=${extensionPath}`);
      options.args.push(`--load-extension=${extensionPath}`);
    }
    const whitelistExtensionIndex = options.args.findIndex((a: string) => a.startsWith('--whitelisted-extension-id'));
    if (whitelistExtensionIndex > -1) {
      debug(`Appending extensionbridge id (${extensionId}) to --whitelisted-extension-id`);
      options.args[whitelistExtensionIndex] += `,${extensionId}`;
    } else {
      debug(`Adding arg --whitelisted-extension-id=${extensionId}`);
      options.args.push(`--whitelisted-extension-id=${extensionId}`);
    }
  } else {
    debug(`Adding args --whitelisted-extension-id=${extensionId} and --load-extension=${extensionPath}`);
    options.args = [`--load-extension=${extensionPath}`, `--whitelisted-extension-id=${extensionId}`];
  }
  return options;
}

export async function decorateBrowser(
  browser: Browser,
  config?: PluginConfig,
): Promise<Browser & BrowserExtensionBridge> {
  debug(`waiting for extension's background page`);
  const extTarget = await browser.waitForTarget((t) => {
    // @ts-ignore
    return t.type() === 'background_page' && t._targetInfo.title === 'Puppeteer Extension Controller';
  });
  debug(`background page found, id: ${extTarget._targetId}`);
  const extPage = await extTarget.page();
  if (!extPage)
    throw new Error(
      `puppeteer-extensionbridge failed to find the extension's background page. If this happened during normal use, it is a bug and should be reported.`,
    );
  const bridge = new ExtensionBridge(extPage);
  debug(`passed config: %o`, config);
  if (config) {
    await bridge.setConfig(config);
  }
  return Object.assign(browser, { extension: bridge });
}
