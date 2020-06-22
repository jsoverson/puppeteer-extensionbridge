// Using a local file is probably temporary due to 
// puppeteer@4.0.0 issues: https://twitter.com/jsoverson/status/1273283398816186368
import puppeteer from './test/puppeteer';

import { decorateBrowser, mergeLaunchOptions } from './src';

(async function main() {
  const launchOptions = mergeLaunchOptions({ headless: false });
  const vanillaBrowser = await puppeteer.launch(launchOptions);
  const browser = await decorateBrowser(vanillaBrowser);

  await browser.extension.send("chrome.storage.sync.set", { myKey: "myValue" });

  const { value: [items] } = await browser.extension.send("chrome.storage.sync.get", ["myKey"]);
  // items is { myKey: "myValue" }

  let callback = (...args: any[]) => { console.log(args) };
  await browser.extension.addListener("chrome.storage.onChanged", callback);

  await browser.extension.send("chrome.storage.sync.set", { myKey: "changedValue" });

  await browser.extension.removeListener("chrome.storage.onChanged", callback);

  await browser.close();
}());