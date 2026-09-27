const fs = require('fs');
const f = v => { const r = Math.round(v*100)/100; return String(r); };

function crOpen(P, tension=1){
  let d='';
  for(let i=0;i<P.length-1;i++){
    const p0=P[i-1]||P[i], p1=P[i], p2=P[i+1], p3=P[i+2]||P[i+1];
    const c1=[p1[0]+(p2[0]-p0[0])/6*tension, p1[1]+(p2[1]-p0[1])/6*tension];
    const c2=[p2[0]-(p3[0]-p1[0])/6*tension, p2[1]-(p3[1]-p1[1])/6*tension];
    d+='C'+f(c1[0])+' '+f(c1[1])+' '+f(c2[0])+' '+f(c2[1])+' '+f(p2[0])+' '+f(p2[1]);
  }
  return d;
}
function closedOutline(A,B){
  // A: tip -> base along one edge ; B: base -> tip along the other ; join with a tiny base cap
  return 'M'+f(A[0][0])+' '+f(A[0][1])+crOpen(A)+'L'+f(B[0][0])+' '+f(B[0][1])+crOpen(B)+'Z';
}
function lens(T,B,hw,N=16){
  const dx=B[0]-T[0], dy=B[1]-T[1], L=Math.hypot(dx,dy);
  const nx=dy/L, ny=-dx/L;
  const right=[], left=[];
  for(let i=0;i<N;i++){
    const t=i/(N-1), w=hw(t);
    const x=T[0]+dx*t, y=T[1]+dy*t;
    right.push([x+nx*w, y+ny*w]);
    left.push([x-nx*w, y-ny*w]);
  }
  const back=left.slice(1).reverse();
  return 'M'+f(T[0])+' '+f(T[1])+crOpen(right)+crOpen(back)+'Z';
}
function poly(pts){ return 'M'+pts.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z'; }

// ---------- variant builders ----------
function buildFeather(cfg){
  const R=cfg.right, Lft=cfg.left;
  const baseR=[cfg.base[0], cfg.base[1]], baseL=[-cfg.base[0], cfg.base[1]];
  const A=[[0,0]].concat(R).concat([baseR]);
  const B=[baseL].concat(Lft).concat([[0,0]]);
  return closedOutline(A,B);
}

const VARIANTS = {};

// ---- A : smooth asymmetric feather, thin rachis, real nib ----
(function(){
  const feather = buildFeather({
    right:[[11,10],[21,30],[27,54],[28,78],[24,100],[16,120],[7,134]],
    left:[[-4,12],[-8,32],[-10.5,56],[-11,80],[-9.5,102],[-6,122],[-2,134]],
    base:[3,138]
  });
  const rachis = lens([1.2,14],[-4.2,129], t=>1.25*Math.pow(Math.sin(Math.PI*t),0.7));
  const nibSlit = lens([0,180],[0,199], t=>0.75*Math.pow(Math.sin(Math.PI*t),0.6), 12);
  const hole = 'M0 175.6A2.4 2.4 0 1 0 0 180.4A2.4 2.4 0 1 0 0 175.6Z';
  const shaft = poly([[-3.1,120],[-2.9,164],[-4.8,172],[-4.6,184],[0,203],[4.6,184],[4.8,172],[2.9,164],[3.1,120]]);
  VARIANTS.A = {true:'<path fill-rule="evenodd" d="'+feather+' '+rachis+'"/>',
                nib:'<path fill-rule="evenodd" d="'+shaft+' '+nibSlit+' '+hole+'"/>'};
})();

// ---- B : A but with shallow clefts for feather barbs ----
(function(){
  const feather = buildFeather({
    right:[[11,10],[21,30],[27,54],[27,78],[24,100],[16,120],[7,134]],
    left:[[-4,12],[-8,32],[-10.5,56],[-11,80],[-9.5,102],[-6,122],[-2,134]],
    base:[3,138]
  });
  const rachis = lens([1.2,14],[-4.2,129], t=>1.0*Math.pow(Math.sin(Math.PI*t),0.7));
  const shaft = poly([[-3.1,120],[-2.9,164],[-4.8,172],[-4.6,184],[0,203],[4.6,184],[4.8,172],[2.9,164],[3.1,120]]);
  VARIANTS.B = {true:'<path fill-rule="evenodd" d="'+feather+' '+rachis+'"/>', nib:'<path d="'+shaft+'"/>'};
})();

// ---- C : broad feather, very short shaft, bold nib ----
(function(){
  const feather = buildFeather({
    right:[[14,11],[26,32],[33,58],[33,84],[27,108],[17,126],[7,138]],
    left:[[-6,13],[-11,34],[-14,60],[-14,86],[-12,108],[-8,126],[-2,138]],
    base:[3,142]
  });
  const rachis = lens([1.4,15],[-4.6,133], t=>1.3*Math.pow(Math.sin(Math.PI*t),0.7));
  const shaft = poly([[-3.4,124],[-3.2,166],[-5.4,174],[-5.0,186],[0,205],[5.0,186],[5.4,174],[3.2,166],[3.4,124]]);
  VARIANTS.C = {true:'<path fill-rule="evenodd" d="'+feather+' '+rachis+'"/>', nib:'<path d="'+shaft+'"/>'};
})();

// ---------- emit preview ----------
const ANGLE = 35;
const K = 0.94;
function svgFor(v, color, scale){
  const g = 'transform="translate(128 128) scale('+(K*scale)+') rotate('+ANGLE+') translate(-3 -101)"';
  return '<g '+g+' fill="'+color+'">'+VARIANTS[v].true+VARIANTS[v].nib+'</g>';
}
let cells='';
const sizes=[256,128,64,32,16];
for(const v of ['A','B','C']){
  cells+='<div class="row"><div class="tag">'+v+'</div>';
  for(const s of sizes){
    cells+='<div class="cell"><svg width="'+s+'" height="'+s+'" viewBox="0 0 256 256">'+svgFor(v,'#000',1)+'</svg><span>'+s+'</span></div>';
  }
  cells+='</div>';
}
cells+='<div class="row dark"><div class="tag">white</div>';
for(const v of ['A','B','C']){
  cells+='<div class="cell"><svg width="96" height="96" viewBox="0 0 256 256">'+svgFor(v,'#fff',1)+'</svg><span>'+v+'</span></div>';
}
cells+='</div>';

const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
'html,body{margin:0;background:#fff;font:12px "Segoe UI",sans-serif;color:#333}'+
'.row{display:flex;align-items:flex-end;gap:26px;padding:14px 24px;border-bottom:1px solid #eee}'+
'.dark{background:#0e0e10}.dark .tag,.dark .cell span{color:#888}'+
'.cell{display:flex;flex-direction:column;align-items:center;gap:5px}.cell span{font-size:10px;color:#999}'+
'.tag{width:60px;font-weight:600;color:#666}.dark .cell span{color:#999}'+
'</style></head><body>'+cells+'</body></html>';
fs.writeFileSync('D:/2-Area/github-repos/quill/.preview/sheet2.html', html);

// ---------- save current geometry for later reuse ----------
fs.writeFileSync('D:/2-Area/github-repos/quill/.preview/geom.json', JSON.stringify(VARIANTS,null,1));
console.log('ok', Object.keys(VARIANTS).map(k=>k+':'+VARIANTS[k].true.length));
