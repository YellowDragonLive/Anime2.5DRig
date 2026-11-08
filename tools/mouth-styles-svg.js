// node tools/mouth-styles-svg.js → docs/mouth-styles/<style>.svg (all keyframes of each style side by side)
'use strict';
const fs=require('fs'),path=require('path'),MS=require('../lib/mouthstyles.js');
const out=path.join(__dirname,'..','docs','mouth-styles');fs.mkdirSync(out,{recursive:true});
const names={closed:'閉',a:'あ',i:'い',u:'う',e:'え',o:'お'};
for(const s of MS.STYLES){
  let body='';
  MS.VOWELS.forEach((v,i)=>{
    const inner=MS.toSVG(s.id,v).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/id="cav"/g,'id="cav'+i+'"').replace(/url\(#cav\)/g,'url(#cav'+i+')');
    body+='<g transform="translate('+(i*3+1.5)+',0.8)">'+inner+'</g><text x="'+(i*3+1.5)+'" y="2.3" font-size="0.35" text-anchor="middle" fill="#555">'+names[v]+'</text>';
  });
  fs.writeFileSync(path.join(out,s.id+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 2.6" width="900" height="130"><rect width="18" height="2.6" fill="#f6e2d6"/>'+body+'</svg>\n');
}
console.log('wrote',MS.STYLES.map(s=>s.id+'.svg').join(' '));
