# puppeteer-extensionbridge

This library provides a bridge from puppeteer to the chrome extension API so that previously-unavailable interfaces can be controlled programmatically from node & puppeteer.

## Caveat

Extensions don't work in headless mode. This is GUI-only.

## Status : Experimental

This is an early implementation of something that works in non-production analysis scripts. That said, this isn't relying on any experimental APIs so it should remain functional as long as manifest V2 extensions are supported in Chrome.

## Who is this for

- Puppeteer/Devtools power users

## Installation

```shell
$ npm install puppeteer-extensionbridge
```

## Example

```typescript
import puppeteer from 'puppeteer';

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
```

## API

### send(method:string, payload:any): Promise<BridgeResponse>

Sends a message to the extension to run the `method` (e.g. `"chrome.storage.settings.set"`) with the payload as the arguments. The arguments will be JSON-ified and spread across the calling method. Don't pass callbacks as defined by the Chrome extension API. Those are handled by the bridge.

A promise is returned that resolves to a `BridgeResponse` object that contains a `.value` property containing the arguments that were passed to the success callback or an `.error` object containing an error.

### addListener(event: string, callback: Function)

Registers `callback` as a listener to the passed `event`. 

### removeListener(event: string, callback: Function) 

Removes `callback` as a listener to the passed `event`. 

### decorateBrowser(browser: Browser, config: PluginConfig): Browser & BrowserExtensionBridge

Wires up all the magic to the `browser` object and adds the `.extension` property to `browser`.

This mutates the passed `browser` object so you can ignore the return value in vanilla JS. The return value is typed to account for the added `.extension` for TypeScript.

#### Configuration options

##### `newtab`

Specify a URL here for a custom newtab. This is necessary for communicating with new tabs that have not yet navigated to a page due to Chrome's security controls.

### mergeLaunchOptions(options: LaunchOptions): LaunchOptions

This takes in your default puppeteer launch options and adds the options necessary to work with this library. You can
do this by hand but this makes it much easier.

### BridgeResponse

```typescript
interface BridgeResponse {
  value: any[];
  error?: Error;
}
```