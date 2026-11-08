'use strict';
/*
 * i18n regression test.
 *
 * lib/i18n.js is a runtime translation layer: it walks the DOM and also
 * translates strings that app.js builds by concatenation, through the
 * fragment table. A missing fragment silently degrades to Japanese, which is
 * easy to miss in review — so this test pins down the contract:
 *
 *   1. the default language is Simplified Chinese, and ja is still available
 *   2. representative composed strings (the kind app.js assembles at runtime)
 *      come out with no kana left
 *   3. the Chinese dictionary itself never contains kana (a sign that an entry
 *      was pasted from the Japanese source untranslated)
 *   4. index.html loads i18n.js before app.js, and the localized guide exists
 *
 * Run: node tests/i18n.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KANA = /[\u3041-\u3096\u30a1-\u30fa]/;

/* Minimal DOM so i18n.js boots without a browser. readyState 'loading' keeps
   boot() waiting for DOMContentLoaded, so nothing touches real nodes. */
function loadI18N(search) {
  const sandbox = {
    location: { search: search || '' },
    localStorage: { getItem: () => null, setItem: () => {} },
    URLSearchParams,
    console,
    document: {
      title: 'Anime2.5DRig — PSDドロップで動くアバター',
      readyState: 'loading',
      addEventListener() {},
      documentElement: { lang: '' },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
      createTreeWalker: () => ({ nextNode: () => null }),
      dispatchEvent() {}
    },
    MutationObserver: class { observe() {} },
    NodeFilter: { SHOW_TEXT: 4 },
    CustomEvent: class { constructor() {} }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib/i18n.js'), 'utf8'), sandbox, { filename: 'lib/i18n.js' });
  return sandbox.I18N;
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) { failures++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}

// ---- 1. language resolution ----
const zh = loadI18N('');
check('默认语言是简体中文', zh.lang === 'zh-CN', 'got ' + zh.lang);
check('仍可选日文', zh.languages.some(l => l.id === 'ja'));
check('中文指南文件存在', fs.existsSync(path.join(ROOT, zh.readmeFile())), zh.readmeFile());
check('?lang=ja 可覆盖默认值', loadI18N('?lang=ja').lang === 'ja');

// ---- 2. composed runtime strings ----
// These mirror what app.js actually assembles: numbers, file names and layer
// names spliced into Japanese templates.
const COMPOSED = [
  'sample2.psd を読み込み中…',
  'sample2.psd を読み込みました',
  '3 か所を手動で調整中',
  '20パーツ / 揺れもの3本を自動リグ\n768 × 768px',
  '前髪 3房・後髪 2房',
  'エラー: PSDは128MB以下にしてください',
  'sample.psd が見つかりません（HTTP 404）',
  '動画を書き出しました（1080 × 1350px・5.0秒・3.2MB）',
  'PNGを書き出しました（1080 × 1350px・透過）',
  '軽量PSDを保存しました（12.3MB / ノイズ除去+トリム済み）',
  '設定を読み込みました（レイヤー構成の違い 2 件は初期値のまま）。「調整を保存」で記憶できます',
  '未知のレイヤー名 "cape" — 頭に追従させます',
  '空のレイヤー "a" をスキップしました',
  '口のスタイル: アニメ標準',
  '元の口は閉じた絵（閉じ口に使用） · おまかせ=アニメ標準 · 「口」でスタイル変更可',
  'voice.mp3 を再生して口パクします（マイク口パクを押すと停止）',
  '音声を再生できません: NotSupportedError'
];
for (const s of COMPOSED) {
  const out = zh.t(s);
  check('拼接串已翻译: ' + s.slice(0, 24), !KANA.test(out), out);
}
check('日文模式下原样返回', loadI18N('?lang=ja').t('PSDを開く') === 'PSDを開く');

// ---- 3. dictionary hygiene ----
const src = fs.readFileSync(path.join(ROOT, 'lib/i18n.js'), 'utf8');
const dictBody = src.slice(src.indexOf('var ZH = {'), src.indexOf('/* Fragment dictionary'));
const entries = [...dictBody.matchAll(/'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'/g)];
check('字典条目数 > 200', entries.length > 200, 'got ' + entries.length);
const dirty = entries.filter(([, , v]) => KANA.test(v));
check('中文值里没有残留假名', dirty.length === 0, dirty.slice(0, 5).map(d => d[1] + ' ⇒ ' + d[2]).join(' / '));
const empty = entries.filter(([, , v]) => !v.trim());
check('没有空翻译', empty.length === 0, empty.slice(0, 3).map(d => d[1]).join(' / '));

// ---- 4. wiring ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const at = name => html.indexOf('<script src="lib/' + name + '"></script>');
check('index.html 在 app.js 之前加载 i18n.js', at('i18n.js') > 0 && at('i18n.js') < at('app.js'));
const app = fs.readFileSync(path.join(ROOT, 'lib/app.js'), 'utf8');
check('README 按语言加载', app.includes('I18N.readmeFile()'));
check('切换语言会重载指南', app.includes("addEventListener('i18n:change'"));

if (failures) {
  console.log('i18n tests: ' + failures + ' failure(s)');
  process.exit(1);
}
console.log('i18n tests: 默认中文, 17 组拼接串, 字典洁净度, 加载顺序 passed');
