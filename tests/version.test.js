'use strict';
/*
 * Version consistency test.
 *
 * The version lives in two places that nobody bumps together in practice:
 * package.json (npm) and APP_VERSION in lib/app.js (what the header shows and
 * what settings/backup files record as `app`). v2.2 and v2.3 both shipped with
 * the header still reading v2.0, so pin it down here instead of in review.
 *
 *   1. package.json version === APP_VERSION in lib/app.js
 *   2. the static fallback in index.html (#appVersion) matches them too, so the
 *      first paint before app.js runs never shows a stale number
 *   3. the header formatting rule (strip a trailing .0) still yields that label
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const pkgVersion = JSON.parse(read('package.json')).version;
const appJs = read('lib/app.js');
const declared = (appJs.match(/const APP_VERSION\s*=\s*'([^']+)'/) || [])[1];

assert.ok(declared, 'lib/app.js must declare APP_VERSION as a single-quoted string');
assert.strictEqual(declared, pkgVersion,
  `APP_VERSION (${declared}) must equal package.json version (${pkgVersion})`);

// label as rendered by app.js: 'v' + version with a trailing .0 removed
const label = 'v' + pkgVersion.replace(/\.0$/, '');
const html = read('index.html');
const staticLabel = (html.match(/id="appVersion">([^<]*)</) || [])[1];
assert.strictEqual(staticLabel, label,
  `index.html #appVersion (${staticLabel}) must match ${label} — it is what shows before app.js runs`);

// the rule itself: 2.3.0 -> v2.3, 2.0.0 -> v2.0 (not v2), 2.3.1 stays 2.3.1
assert.strictEqual('v' + '2.3.0'.replace(/\.0$/, ''), 'v2.3');
assert.strictEqual('v' + '2.0.0'.replace(/\.0$/, ''), 'v2.0');
assert.strictEqual('v' + '2.3.1'.replace(/\.0$/, ''), 'v2.3.1');

console.log('version tests: package.json / APP_VERSION / index.html label agree on ' + label);
