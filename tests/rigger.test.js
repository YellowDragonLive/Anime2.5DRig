'use strict';

const assert = require('assert');
const Rigger = require('../lib/rigger.js');

function solidLayer(name, left, top, width, height, hidden) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 80;
    data[i * 4 + 3] = 255;
  }
  return { name, left, top, hidden, imageData: { width, height, data } };
}

const psd = {
  width: 300,
  height: 300,
  children: [
    { name: 'face group', children: [
      solidLayer('face', 80, 30, 140, 130),
      solidLayer('eyewhite_1', 100, 75, 30, 12),
      solidLayer('eyewhite_2', 170, 75, 30, 12),
      solidLayer('irides_1', 108, 76, 12, 10),
      solidLayer('irides_2', 180, 76, 12, 10)
    ] },
    solidLayer('mouth_open', 130, 125, 40, 16),
    solidLayer('neck', 130, 155, 40, 80),
    solidLayer('ignored', 0, 0, 300, 300, true)
  ]
};

assert.strictEqual(Rigger._internals.imageLayersOf(psd).length, 7);
assert.strictEqual(Rigger.normName('eyeclose2'), 'eye_close2');
assert.strictEqual(Rigger.baseName('eye_close2'), 'eye_close2');
const rig = Rigger.buildRig(psd);
assert.ok(rig.anchors.eyeL && rig.anchors.eyeR, 'numbered eye layers should produce both anchors');
assert.ok(rig.anchors.eyeL.icx < rig.anchors.eyeR.icx, 'iris anchors should keep left/right order');
assert.strictEqual(rig.layers.some(layer => layer.name === 'ignored'), false);

const stats = Rigger.cleanPsdLayers(psd);
assert.strictEqual(stats.layers, 7);
assert.throws(
  () => Rigger.buildRig({ width: 6000, height: 5000, children: [] }),
  /大きすぎ/
);

// Empty semantic layers must fall back to usable anchors, not dereference null.
const emptyFace = solidLayer('face', 0, 0, 20, 20);
emptyFace.imageData.data.fill(0);
const fallback = Rigger.buildRig({width:100,height:100,children:[emptyFace,solidLayer('mouth_open',35,55,30,12)]});
assert.ok(Number.isFinite(fallback.anchors.face.cx));
assert.ok(fallback.warnings.some(w=>w.includes('空のレイヤー')));
for(const name of ['__proto__','constructor','toString','<img src=x onerror=alert(1)>']) {
  const unusual=Rigger.buildRig({width:100,height:100,children:[solidLayer(name,10,10,40,40)]});
  assert.ok(Number.isFinite(unusual.layers[0].depth),name);
}
assert.throws(()=>Rigger.buildRig({width:100,height:100,children:[emptyFace]}),/画素/);
assert.throws(()=>Rigger.validatePsd({width:2.5,height:100,children:[]}),/サイズ/);

const custom = solidLayer('generic',0,0,30,8).imageData;
const partial=structuredClone(psd);
partial.children.push(solidLayer('eye_close',100,81,30,8),solidLayer('eye_close2',170,81,30,8));
const repaired=Rigger.buildRig(partial,{generic:{eyeL:custom,eyeR:custom}});
assert.equal(repaired.layers.filter(p=>p.synthetic&&p.fade==='eyeClose').length,1);
assert.equal(repaired.layers.find(p=>p.synthetic&&p.fade==='eyeClose').side,'R');
assert.ok(repaired.layers.some(p=>p.fade==='eyeClose2'));

const thin = new Uint8Array(8*100).fill(255);
const strands = Rigger._internals.detectStrands(thin,8,100,30,6);
assert.ok(strands.length>0);
assert.equal(new Set(strands.map(s=>s.x)).size,strands.length);

const translucent = {width:2,height:1,data:new Uint8ClampedArray([255,0,0,128,0,0,255,0])};
const enlarged=Rigger._internals.resampleRGBA(translucent,4,1);
assert.deepEqual([...enlarged.slice(0,4)],[255,0,0,128]);
assert.equal(enlarged[4],255,'transparent blue must not darken or tint red edges');
assert.equal(enlarged[6],0);
const composite=Rigger.flattenPsdToImg({width:2,height:2,children:[{name:'red',left:0,top:0,imageData:{width:1,height:1,data:new Uint8ClampedArray([255,0,0,128])}}]});
assert.deepEqual([...composite.data],[255,0,0,128]);

// Japanese names, see-through variants and numbered parts resolve to slots.
const aliasCases = {
  '前髪': 'front hair', '前髪2': 'front hair_2', 'Front_Hair': 'front hair', 'front hair 1': 'front hair_1',
  '後ろ髪': 'back hair', '白目': 'eyewhite', '瞳': 'irides', 'まつ毛': 'eyelash', '眉毛': 'eyebrow',
  '閉じ目': 'eye_close', '閉じ目2': 'eye_close2', 'eye_close_2': 'eye_close_2', 'eyeclose2': 'eye_close2',
  '閉じ口': 'mouth_close', '口': 'mouth_open', '顔 のコピー': 'face', 'face copy 2': 'face',
  'bottom wear': 'bottomwear', 'メガネ': 'eyewear', 'しっぽ': 'tail', 'ピアス': 'earwear', 'layer 12': 'layer 12'
};
for (const [raw, expected] of Object.entries(aliasCases)) assert.strictEqual(Rigger.normName(raw), expected, raw);

// Plain "hair" is front hair above the face and back hair below it.
const hairRig = Rigger.buildRig({ width: 200, height: 200, children: [
  solidLayer('hair', 40, 10, 120, 170), solidLayer('face', 60, 30, 80, 90), solidLayer('hair', 50, 20, 100, 40)
] });
assert.deepStrictEqual(hairRig.layers.map(l => l.name), ['back hair', 'face', 'front hair']);
assert.ok(hairRig.layers[2].strands.length > 0, 'front hair gets strands');
assert.strictEqual(hairRig.layers[1].source, 'face');

// Earrings and tails swing; unknown names are reported but still follow a group.
const accRig = Rigger.buildRig({ width: 300, height: 300, children: [
  solidLayer('face', 90, 40, 120, 130), solidLayer('ピアス', 80, 120, 10, 40), solidLayer('earwear', 210, 120, 10, 40),
  solidLayer('tail', 20, 180, 40, 100), solidLayer('mystery', 100, 250, 20, 20)
] });
const ear = accRig.layers.filter(l => l.name === 'earwear');
assert.strictEqual(ear.length, 2);
assert.ok(ear.every(l => l.phys === 'sway' && l.strands.length >= 1));
assert.strictEqual(accRig.layers.find(l => l.name === 'tail').phys, 'sway');
const mystery = accRig.layers.find(l => l.name === 'mystery');
assert.ok(mystery.unknown && mystery.group === 'body');
assert.strictEqual(Rigger.roleLabel('front hair'), '前髪');

console.log('rigger tests: 20 scenarios passed');

// ---- face-part stacking order (see-through can emit eyewhite above irides, eyebrow under face) ----
{
  // one layer holding both eyes (two blocks, gap at the face centre), as see-through emits them
  function pair(name, top, h, w) {
    w = w || 40;
    const L = solidLayer(name, 100, top, 100, h), d = L.imageData.data;
    for (let y = 0; y < h; y++) for (let x = w; x < 100 - w; x++) d[(y * 100 + x) * 4 + 3] = 0;
    return L;
  }
  const names = rig => rig.layers.map(l => l.name);
  const idx = (rig, n) => names(rig).indexOf(n);
  const bad = Rigger.buildRig({ width: 300, height: 300, children: [
    solidLayer('back hair', 60, 10, 180, 200),
    pair('eyebrow', 55, 8),          // under the face: would be hidden
    solidLayer('face', 80, 30, 140, 130),
    pair('irides', 76, 10, 30),
    pair('eyelash', 70, 8),
    pair('eyewhite', 74, 14),       // above irides AND eyelash
    solidLayer('mouth', 135, 125, 30, 10),
    solidLayer('front hair', 70, 20, 160, 50)
  ] });
  for (const s of ['l', 'r']) {
    assert.ok(idx(bad, 'face') < idx(bad, 'eyebrow_' + s), 'eyebrow must be drawn above the face');
    assert.ok(idx(bad, 'eyewhite_' + s) < idx(bad, 'irides_' + s), 'eyewhite must be under the irides');
    assert.ok(idx(bad, 'eyewhite_' + s) < idx(bad, 'eyelash_' + s), 'eyewhite must be under the eyelash');
  }
  assert.ok(idx(bad, 'front hair') === bad.layers.length - 1 || idx(bad, 'front hair') > idx(bad, 'eyelash_r'), 'bangs stay on top');
  assert.ok(bad.warnings.some(w => /重なり順/.test(w)), 'reordering is reported');
  // a correct PSD is left exactly as painted
  const good = Rigger.buildRig({ width: 300, height: 300, children: [
    solidLayer('face', 80, 30, 140, 130), pair('eyewhite', 74, 14), pair('irides', 76, 10, 30),
    pair('eyelash', 70, 8), pair('eyebrow', 55, 8), solidLayer('front hair', 70, 20, 160, 50)
  ] });
  assert.ok(!good.warnings.some(w => /重なり順/.test(w)), 'nothing to fix → no reorder');

  // no eyewhite: eyes still get anchors (and therefore a closed eye)
  const GP = require('../lib/genericparts.js');
  const noWhite = Rigger.buildRig({ width: 300, height: 300, children: [
    solidLayer('face', 80, 30, 140, 130), pair('irides', 76, 10, 30), pair('eyelash', 70, 8)
  ] }, { generic: { eyeL: GP.get('eyeL'), eyeR: GP.get('eyeR') } });
  assert.ok(noWhite.anchors.eyeL && noWhite.anchors.eyeR, 'irides/eyelash give the eye anchors when eyewhite is missing');
  assert.ok(noWhite.layers.some(l => l.fade === 'eyeClose' && l.side === 'L') && noWhite.layers.some(l => l.fade === 'eyeClose' && l.side === 'R'), 'closed eyes are synthesized without eyewhite');

  // a light brow blob fused on top of the lash line is moved out of the eyelash layer
  const lash = solidLayer('eyelash', 98, 60, 104, 30);
  const d = lash.imageData.data;
  for (let y = 0; y < 30; y++) for (let x = 0; x < 104; x++) {
    const q = (y * 104 + x) * 4, inEye = x < 40 || x > 64;
    const ink = y >= 12 && y < 16 && inEye;                       // lash line at the eyewhite top
    const blob = y >= 2 && y < 12 && ((x >= 8 && x < 30) || (x >= 74 && x < 96)); // thick light blob above, touching it
    d[q] = d[q + 1] = d[q + 2] = ink ? 20 : 190; d[q + 3] = ink || blob ? 255 : 0;
  }
  const brow = Rigger.buildRig({ width: 300, height: 300, children: [
    solidLayer('face', 80, 30, 140, 130), pair('eyewhite', 72, 16), pair('irides', 74, 12, 30), lash
  ] });
  const moved = brow.layers.filter(l => /^eyebrow_9_/.test(l.name));
  assert.strictEqual(moved.length, 2, 'brow pieces split from both lashes');
  assert.ok(moved.every(l => !l.fade), 'split brow does not fade on blink');
}
console.log('rigger: face order / eyewhite-less eyes / brow-in-lash passed');

// ---- garment stacking order (skirt emitted above the jacket / legs above the skirt) ----
{
  const names = rig => rig.layers.map(l => l.name);
  const idx = (rig, n) => names(rig).indexOf(n);
  const face = solidLayer('face', 100, 20, 100, 100);
  const top = solidLayer('topwear', 95, 120, 110, 90);            // y 120..210
  const skirt = solidLayer('bottomwear', 90, 185, 120, 70);       // y 185..255, overlaps the torso hem
  const legs = solidLayer('legwear', 105, 240, 90, 50);           // y 240..290, overlaps the skirt
  const rig = children => Rigger.buildRig({ width: 300, height: 300, children });

  // skirt painted after the jacket: its waistband eats the jacket hem
  const skirtOnTop = rig([face, legs, top, skirt]);
  assert.ok(idx(skirtOnTop, 'bottomwear') < idx(skirtOnTop, 'topwear'), 'skirt goes back under the jacket');
  assert.ok(idx(skirtOnTop, 'legwear') < idx(skirtOnTop, 'bottomwear'), 'skirt stays over the legs');
  assert.ok(skirtOnTop.warnings.some(w => /服の重なり順/.test(w)), 'garment reordering is reported');

  // legs painted after the skirt: the thighs print over it
  const legsOnTop = rig([face, top, skirt, legs]);
  assert.ok(idx(legsOnTop, 'legwear') < idx(legsOnTop, 'bottomwear'), 'legs are dropped under the skirt');
  assert.ok(legsOnTop.warnings.some(w => /服の重なり順/.test(w)), 'leg reordering is reported');

  // arms keep the painter's order: those layers carry the inpainted backfill of
  // whatever they cover, so lifting them would stamp that fill on the clothes
  const armsOnTop = rig([face, legs, skirt, top, solidLayer('handwear', 70, 150, 160, 130)]);
  assert.ok(idx(armsOnTop, 'handwear') > idx(armsOnTop, 'topwear'), 'handwear is left where the artist put it');
  assert.ok(!armsOnTop.warnings.some(w => /服の重なり順/.test(w)), 'no garment warning when only arms are above');

  // an already correct stack is not touched
  const ok = rig([face, legs, skirt, top, solidLayer('neckwear', 120, 110, 60, 20)]);
  assert.ok(!ok.warnings.some(w => /服の重なり順/.test(w)), 'correct garment order → no reorder');
  assert.ok(idx(ok, 'neckwear') > idx(ok, 'topwear'), 'collar stays over the jacket');
}
console.log('rigger: garment order (skirt/jacket, legs/skirt, arms untouched) passed');
