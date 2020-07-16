import { Puppeteer } from 'puppeteer/lib/cjs/common/Puppeteer';
import findRoot from 'find-root';
import path from 'path';

import { initializePuppeteer } from 'puppeteer/lib/cjs/initialize';

const puppeteer = initializePuppeteer('puppeteer');

export default puppeteer as Puppeteer;
