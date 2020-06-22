import assert from 'assert';

import puppeteer from './puppeteer';

import { decorateBrowser, mergeLaunchOptions, BrowserExtensionBridge } from '../src';
import { start, stop } from './server';
import { Browser } from 'puppeteer/lib/Browser';

const port = 5000;
let baseUrl = `http://127.0.0.1:${port}/`;

describe('Extension Bridge', function () {
  let browser: Browser & BrowserExtensionBridge;

  before((done) => {
    start(port, (_) => {
      console.log('started server');
      done();
    });
  });

  after((done) => {
    console.log('stopping server...');
    stop((_) => {
      console.log('...stopped server');
      done();
    });
  });

  beforeEach(async () => {
    const vanillaBrowser = await puppeteer.launch(mergeLaunchOptions({ headless: false }));
    browser = await decorateBrowser(vanillaBrowser, { newtab: `${baseUrl}newtab.html` });
  })

  afterEach(async () => {
    await browser.close();
  })

  it('should execute arbitary commands', async function () {
    await browser.extension.send("chrome.storage.sync.set", { myKey: "myValue" });
    const { value: [items] } = await browser.extension.send("chrome.storage.sync.get", ["myKey"]);
    assert.equal(items.myKey, "myValue");
  });
  it('should pass arbitary number of arguments', async function () {
    const [page] = await browser.pages();
    await page.goto(baseUrl, {});
    const response = await browser.extension.send("chrome.tabs.query", { active: true });
    const [results] = response.value;
    const activeTab = results[0];
    const tabId = activeTab.id;

    const details = {
      code: `(function(){return "inpage" + "-result" }())`,
      matchAboutBlank: true
    }
    const executeResponse = await browser.extension.send("chrome.tabs.executeScript", tabId, details);
    const [result] = executeResponse.value;
    assert.equal(result, "inpage-result");
  });
  it('should receive arbitrary events', async function () {
    let receivedChange = false;
    await browser.extension.send("chrome.storage.sync.set", { myKey: "myValue" });
    await browser.extension.addListener("chrome.storage.onChanged", (changes: object, areaName: string) => {
      receivedChange = true;
    });
    await browser.extension.send("chrome.storage.sync.set", { myKey: "changedValue" });
    assert(receivedChange);
  });
  it('should set and receive configuration', async function () {
    await browser.extension.setConfig({ myKey: 'myVal' });
    const get = await browser.extension.getConfig();
    assert.equal(get.myKey, 'myVal');
  });
  it('should set and receive configuration', async function () {
    await browser.extension.setConfig({ myKey: 'myVal' });
    const get = await browser.extension.getConfig();
    assert.equal(get.myKey, 'myVal');
  });
  it('should remove event listeners', async function () {
    let eventFired = false;
    let cb = (changes: object, areaName: string) => {
      eventFired = true;
    };
    await browser.extension.addListener("chrome.storage.onChanged", cb);
    await browser.extension.removeListener("chrome.storage.onChanged", cb);
    await browser.extension.send("chrome.storage.sync.set", { myKey: "changedValue" });
    assert(eventFired === false);
  });
});
