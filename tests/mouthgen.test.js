'use strict';
// Procedural mouth: analysis, five vowel shapes, continuity, jaw, vowel estimate, rig hookup.
// Optional: MOUTHGEN_PSD=path/to/see-through.psd also runs the full worker import on a real PSD.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MG=require('../lib/mouthgen.js'),R=require('../lib/rigger.js');

// --- synthetic see-through-like parts: skin face + a thin closed mouth line ---
function part(x,y,w,h,fn){const d=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const c=fn(i,j),q=(j*w+i)*4;d[q]=c[0];d[q+1]=c[1];d[q+2]=c[2];d[q+3]=c[3];}return {x,y,w,h,img:{width:w,height:h,data:d}};}
const SKIN=[235,200,185,255];
const face=part(100,60,200,240,()=>SKIN);
const mouth=part(176,226,48,10,(i,j)=>{const yc=4+0.004*(i-24)*(i-24);return Math.abs(j-yc)<1.1?[90,40,40,255]:[0,0,0,0];});
const st=MG.analyze(mouth,face);
assert.ok(st,'analysis');
assert.ok(Math.abs(st.c[0]-200)<2&&Math.abs(st.c[1]-230.5)<3,'centre '+st.c);
assert.ok(st.w0>20&&st.w0<26,'half width '+st.w0);
assert.equal(st.origOpen,false,'a line is a closed mouth');
assert.ok(Math.abs(st.th)<0.1,'tilt');

const report=[];
for(const style of MG.STYLE_IDS){
function mask(P){const img=MG.render(st,P,MG.blank(st),style);const m=new Uint8Array(st.box.w*st.box.h);let n=0;for(let k=0;k<m.length;k++){m[k]=img.data[k*4+3]>90?1:0;n+=m[k];}return {m,n,img};}
function extent(m){let x0=1e9,x1=-1,y0=1e9,y1=-1;for(let j=0;j<st.box.h;j++)for(let i=0;i<st.box.w;i++)if(m[j*st.box.w+i]){x0=Math.min(x0,i);x1=Math.max(x1,i);y0=Math.min(y0,j);y1=Math.max(y1,j);}return {w:x1-x0+1,h:y1-y0+1};}
function iou(a,b){let i=0,u=0;for(let k=0;k<a.length;k++){i+=a[k]&b[k];u+=a[k]|b[k];}return i/Math.max(1,u);}
const S={closed:mask(MG.mix({a:1},0,0))};
for(const v of ['a','i','u','e','o'])S[v]=mask(MG.mix({[v]:1},1,0));
const keys=['closed','a','i','u','o'];let worst=0,pair='';   // the five acceptance states (E sits between A and I by design)
for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++){const v=iou(S[keys[a]].m,S[keys[b]].m);if(v>worst){worst=v;pair=keys[a]+'/'+keys[b];}}
const eA=extent(S.a.m),eI=extent(S.i.m),eU=extent(S.u.m);
let prev=null,diffs=[];
for(let s=0;s<=30;s++){const {img}=mask(MG.mix({a:1},s/30,0));if(prev){let d=0;for(let k=0;k<img.data.length;k+=4)d+=Math.abs(img.data[k+3]-prev[k+3]);diffs.push(d);}prev=img.data.slice();}
const sorted=diffs.slice().sort((a,b)=>a-b),med=sorted[sorted.length>>1],pop=Math.max(...diffs)/Math.max(1,med);
report.push(style+': IoU '+worst.toFixed(2)+' A '+(eA.h/eA.w).toFixed(2)+' I/U '+(eI.w/eU.w).toFixed(2)+' pop '+pop.toFixed(2));
assert.ok(worst<=0.6,style+': shapes must be distinct (max pair IoU '+worst.toFixed(2)+' '+pair+')');
assert.ok(eA.h/eA.w>=0.35,style+': A opens wide: '+(eA.h/eA.w).toFixed(2));
assert.ok(eI.w/eU.w>=1.6,style+': I is wider than U: '+(eI.w/eU.w).toFixed(2));
assert.ok(pop<=3,style+': no pop while opening ('+pop.toFixed(2)+')');
if(style==='anime'||style==='measured'){let bright=0;for(let k=0;k<S.i.m.length;k++)if(S.i.m[k]&&S.i.img.data[k*4]>220)bright++;assert.ok(bright>10,style+': I shows teeth');}
}
console.log(report.join('\n'));
// jaw moves the chin down on A, nothing when closed
const chin=[200,295];
assert.ok(MG.jaw(st,MG.mix({a:1},1,0),...chin)[1]>2,'jaw drops');
assert.equal(MG.jaw(st,MG.mix({a:1},0,0),...chin)[1],0);
assert.ok(Math.abs(MG.jaw(st,MG.mix({a:1},1,0),200,150)[1])<0.01,'forehead stays');
// mix: vowel interpolation is in parameter space
const half=MG.mix({a:0.5,u:0.5},1,0);
assert.ok(Math.abs(half.s-(MG.VOWELS.a.s+MG.VOWELS.u.s)/2)<1e-9);

// --- vowel estimate on synthetic two-formant vowels ---
function vowelWave(f1,f2,sr=48000,N=1024,f0=220){
  const x=new Float32Array(N);let y1=[0,0],y2=[0,0];
  const res=(f,bw)=>{const r=Math.exp(-Math.PI*bw/sr);return [2*r*Math.cos(2*Math.PI*f/sr),-r*r];};
  const [a1,b1]=res(f1,80),[a2,b2]=res(f2,120);
  for(let n=0;n<N;n++){const e=n%Math.round(sr/f0)===0?1:0,s1=e+a1*y1[0]+b1*y1[1];y1=[s1,y1[0]];const s2=s1+a2*y2[0]+b2*y2[1];y2=[s2,y2[0]];x[n]=s2;}
  let m=0;for(const s of x)m=Math.max(m,Math.abs(s));for(let n=0;n<N;n++)x[n]*=0.3/m;return x;
}
const top=r=>['a','i','u','e','o'].sort((p,q)=>r[q]-r[p])[0];
for(const [v,f] of Object.entries({a:[800,1250],i:[300,2600],u:[350,1450],e:[500,2050],o:[480,850]}))
  assert.equal(top(MG.vowelFromSamples(vowelWave(...f),48000)),v,'vowel '+v);
assert.equal(MG.vowelFromSamples(new Float32Array(1024),48000),null,'silence');

// --- rig hookup ---
const rig={layers:[Object.assign({name:'face',z:0,depth:1,synthetic:false},face),Object.assign({name:'mouth_open',z:1,depth:1.08,fade:'mouthOpen'},mouth),{name:'mouth_close',z:2,synthetic:true,img:{width:1,height:1,data:new Uint8ClampedArray(4)},x:0,y:0,w:1,h:1}]};
MG.attachToRig(rig,R.baseName);
assert.ok(rig.mouthGen);
assert.equal(rig.layers[2].name,'mouth_gen');assert.equal(rig.layers[2].z,1.5);
assert.equal(rig.layers[2].img.data.length,rig.layers[2].w*rig.layers[2].h*4);
MG.attachToRig(rig,R.baseName);assert.equal(rig.layers.filter(l=>l.name==='mouth_gen').length,1,'idempotent');
const drawn={layers:[{name:'mouth_open',img:mouth.img,x:0,y:0},{name:'mouth_close',img:mouth.img,x:0,y:0}]};
assert.equal(MG.attachToRig(drawn,R.baseName),null,'hand-drawn mouth_close keeps the old behaviour');

// --- optional: a real see-through PSD ---
if(process.env.MOUTHGEN_PSD){
  const vm=require('node:vm'),ag=require('../lib/ag-psd.min.js'),GP=require('../lib/genericparts.js');
  ag.initializeCanvas(undefined,(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
  const messages=[],scope={agPsd:ag,Rigger:R,RigRuntime:require('../lib/runtime.js'),Uint8Array,Uint8ClampedArray,ArrayBuffer,Set,importScripts(){},postMessage(m){messages.push(m);}};
  vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','lib/psd-worker.js'),'utf8'),scope);
  const bytes=fs.readFileSync(process.env.MOUTHGEN_PSD);
  scope.onmessage({data:{buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),generic:{eyeL:GP.get('eyeL'),eyeR:GP.get('eyeR'),mouth:GP.get('mouth')}}});
  const res=messages.at(-1);assert.ok(!res.error,res.error);
  const st2=MG.attachToRig(res.rig,R.baseName);assert.ok(st2,'real PSD mouth analysed');
  console.log('real PSD: w0='+st2.w0.toFixed(1)+' tilt='+(st2.th*180/Math.PI).toFixed(1)+'° drawnOpen='+st2.origOpen);
}
console.log('mouthgen tests: analysis, '+MG.STYLE_IDS.length+' styles × 5 vowel shapes, continuity, jaw, vowel estimate, rig hookup passed');
