"use strict";
(function(){
  const te=new TextEncoder(), tdd=new TextDecoder();
  const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const CAMP={'群':'qun','漢':'han','晋':'jin','魏':'wei','呉':'wu','蜀':'shu'};
  const ARM={'歩兵':'歩','弓兵':'弓','騎馬兵':'騎'};
  const POSORD={'本営':0,'中衛':1,'前衛':2};
  const SKEY='jissen_pass_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function hl(s,q){s=esc(s);if(!q)return s;const i=s.toLowerCase().indexOf(q.toLowerCase());
    return i<0?s:s.slice(0,i)+'<mark>'+s.slice(i,i+q.length)+'</mark>'+s.slice(i+q.length);}
  function dispGen(n){return (n||'').replace(/^(xp|sp)\s*/i,'');}
  function arr(x){return Array.isArray(x)?x:(x?[x]:[]);}

  let GEN={}, THEORY=[], REAL=[], ALL=[];
  let mode='combo', sel='theory';

  async function decryptBlob(blob,pass){
    const km=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(blob.salt),iterations:blob.iter||250000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(blob.iv)},key,b64d(blob.ct));
    return JSON.parse(tdd.decode(pt));
  }
  async function loadTheory(){
    // 正本：編成ボード本体から（常に最新）。だめなら同梱フォールバック。
    let d=null;
    try{const r=await fetch('../index.html',{cache:'no-store'});
      if(r.ok){const t=await r.text();const m=t.match(/<script id="tierdata"[^>]*>([\s\S]*?)<\/script>/);if(m)d=JSON.parse(m[1]);}}catch(e){}
    if(!d){try{const r=await fetch('./tier-data.json',{cache:'no-store'});if(r.ok)d=await r.json();}catch(e){}}
    if(!d)return;
    (d.generals||[]).forEach(g=>{GEN[g.name]={fac:CAMP[g.camp]||'',arm:ARM[g.arms]||g.arms||''};});
    THEORY=(d.teams||[]).map(t=>({type:'theory',tier:t.tier,score:t.score,name:t.name,
      members:(t.members||[]).map(m=>({pos:m.pos,gen:m.gen,
        t2:arr(m.t2).join('／'),t3:arr(m.t3).join('／'),treasure:m.treasure||'—'}))}));
  }
  function badge(gen){const g=GEN[gen]||{};const fac=g.fac?('<span class="bdg b-'+g.fac+'">'+({wei:'魏',jin:'晋',shu:'蜀',qun:'群',wu:'呉',han:'漢'})[g.fac]+'</span>'):'';
    const arm=g.arm?('<span class="bdg arm">'+esc(g.arm)+'</span>'):'';return fac+arm;}

  function cardHTML(t,q){
    const head = t.type==='theory'
     ? '<span class="src theory">理論</span><span class="tier">'+esc(t.tier)+'</span><span class="score">'+esc(String(t.score))+'</span><span class="nm">'+hl(t.name,q)+'</span>'
     : '<span class="src real">実戦</span><span class="nm">'+esc(t.members.map(m=>dispGen(m.gen)).join('・'))+'</span><span class="meta">ユーザー名：'+hl(t.user||'—',mode==='player'?q:'')+' ・ '+esc(t.date||'')+'</span>';
    const fifthHead=t.type==='theory'?'宝物':'高級兵種';
    const ms=t.members.slice().sort((a,b)=>(POSORD[a.pos]??9)-(POSORD[b.pos]??9));
    const rows=ms.map(m=>{
      const fifth=t.type==='theory'
        ? '<span class="fifth">'+esc(m.treasure||'—')+'</span>'
        : '<span class="fifth u"><span>'+esc(m.u1||'')+'</span><span>'+esc(m.u2||'')+'</span></span>';
      return '<tr><td class="pos">'+esc(m.pos)+'</td><td><div class="gn">'+hl(dispGen(m.gen),q)+'</div><div class="badges">'+badge(m.gen)+'</div></td>'+
        '<td class="tc">'+hl(m.t2||'',q)+'</td><td class="tc">'+hl(m.t3||'',q)+'</td><td>'+fifth+'</td></tr>';
    }).join('');
    return '<div class="pcard"><div class="ph">'+head+'</div><table><thead><tr><th>位置</th><th>武将</th><th>第二戦法</th><th>第三戦法</th><th>'+fifthHead+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function matchCombo(t,q){if(!q)return true;q=q.toLowerCase();
    if((t.name||'').toLowerCase().includes(q))return true;
    return t.members.some(m=>[dispGen(m.gen),m.gen,m.t2,m.t3].some(x=>(x||'').toLowerCase().includes(q)));}
  function matchPlayer(t,q){if(t.type!=='real')return false;if(!q)return true;
    return (t.user||'').toLowerCase().includes(q.toLowerCase());}
  function run(){
    const q=$('q').value.trim();
    let res=ALL.filter(t=>mode==='combo'?matchCombo(t,q):matchPlayer(t,q));
    if(mode==='combo')res=res.filter(t=>t.type===sel);
    res.sort((a,b)=>(a.type===b.type)?0:(a.type==='theory'?-1:1));
    $('count').textContent=res.length+' 件'+(mode==='player'?'（ユーザー名検索＝実戦）':'（'+(sel==='theory'?'理論':'実戦')+'）');
    $('list').innerHTML=res.length?res.map(t=>cardHTML(t,q)).join(''):'<div class="empty">該当なし。別の武将名・戦法名を試してください。</div>';
  }
  function wire(){
    $('q').addEventListener('input',run);
    document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.mode').forEach(x=>x.classList.remove('on'));b.classList.add('on');
      mode=b.dataset.mode;$('filters').style.display=mode==='player'?'none':'flex';
      $('q').placeholder=mode==='player'?'ユーザー名で検索（例：リン）':'武将名・戦法名で検索（例：張遼／戦必断金）';run();}));
    document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');sel=b.dataset.f;run();}));
  }
  async function enter(pass){
    const res=await fetch('./teams-db.enc.json',{cache:'no-store'});
    if(!res.ok)throw new Error('data '+res.status);
    const blob=await res.json();
    REAL=(await decryptBlob(blob,pass)).map(t=>({type:'real',user:t.user||'',date:t.date||'',
      members:(t.members||[]).map(m=>({pos:m.pos,gen:m.gen,t2:m.t2||'',t3:m.t3||'',u1:m.u1||'',u2:m.u2||''}))}));
    if(!THEORY.length)await loadTheory();
    ALL=THEORY.concat(REAL);
    if(!THEORY.length)$('notice').classList.remove('hide');
    $('ov').classList.add('hide');$('app').classList.remove('locked');
    wire();run();
  }
  // ゲート
  $('gf').addEventListener('submit',async e=>{
    e.preventDefault();const err=$('err'),pass=$('pass').value;err.textContent='確認中…';
    try{await enter(pass);try{sessionStorage.setItem(SKEY,pass);}catch(_){}err.textContent='';}
    catch(x){err.textContent='合言葉が違うか、データを読めませんでした。';}
  });
  // セッション復帰
  (async()=>{let p=null;try{p=sessionStorage.getItem(SKEY);}catch(_){}
    if(p){try{await enter(p);}catch(e){try{sessionStorage.removeItem(SKEY);}catch(_){}}}})();
})();
