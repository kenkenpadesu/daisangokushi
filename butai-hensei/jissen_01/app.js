"use strict";
(function(){
  /* ---------- 共通 ---------- */
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ARMS_KANJI={'歩兵':'歩','弓兵':'弓','騎馬兵':'騎'};
  const TIER_ORDER=['T0','T0-','T1','T2-','スタダ'];
  const POSORD={'本営':0,'中衛':1,'前衛':2};
  const SKEY='jissen_pass_v1';
  const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
            set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

  /* ---------- テーマ（編成ボードと同じ保存キーを共有） ---------- */
  function applyTheme(dark){
    document.body.classList.toggle('dark',dark);
    $('themeSwitch').checked=dark;
    $('themeLabel').textContent=dark?'夜':'昼';
    $('themeThumb').textContent=dark?'🌙':'☀';
    ls.set('stzb_dark',dark);
  }
  applyTheme(!!ls.get('stzb_dark',false));
  $('themeSwitch').addEventListener('change',e=>applyTheme(e.target.checked));

  function setStickyOffset(){const h=document.querySelector('header');if(h&&h.offsetHeight)document.documentElement.style.setProperty('--htop',h.offsetHeight+'px');}
  window.addEventListener('resize',setStickyOffset);
  window.addEventListener('orientationchange',()=>setTimeout(setStickyOffset,150));

  /* ---------- データ ---------- */
  let GEN={}, THEORY=[], REAL=[];
  let tab='theory', tierSel='T0', userSel='ALL';

  const te=new TextEncoder(), td=new TextDecoder();
  const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  async function decryptBlob(blob,pass){
    const km=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(blob.salt),iterations:blob.iter||250000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(blob.iv)},key,b64d(blob.ct));
    return JSON.parse(td.decode(pt));
  }
  async function loadTheory(){
    let d=null;
    try{const r=await fetch('../index.html',{cache:'no-store'});
      if(r.ok){const t=await r.text();const m=t.match(/<script id="tierdata"[^>]*>([\s\S]*?)<\/script>/);if(m)d=JSON.parse(m[1]);}}catch(e){}
    if(!d){try{const r=await fetch('./tier-data.json',{cache:'no-store'});if(r.ok)d=await r.json();}catch(e){}}
    if(!d)return false;
    (d.generals||[]).forEach(g=>{GEN[g.name]={camp:g.camp||'',arms:g.arms||''};});
    THEORY=d.teams||[];
    return true;
  }
  function badge(n){const g=GEN[n]||{};if(!g.camp&&!g.arms)return '';
    return '<span class="cbadge">'+(g.camp?'<span class="camp c'+esc(g.camp)+'">'+esc(g.camp)+'</span>':'')+(g.arms?'<span class="arms">'+esc(ARMS_KANJI[g.arms]||'')+'</span>':'')+'</span>';}
  const arr=x=>Array.isArray(x)?x:(x?[x]:[]);
  const slash=a=>arr(a).map(esc).join('<span class="slash">/</span>');
  const tierCls=t=>t==='スタダ'?'SUTA':t;
  const dispGen=n=>String(n||'');

  /* ---------- 検索 ---------- */
  function hit(q,...vals){return vals.some(v=>arr(v).some(x=>String(x||'').toLowerCase().includes(q)));}
  function theoryMatch(t,q){return hit(q,t.name,t.name_zh)||t.members.some(m=>hit(q,m.gen,m.gen_zh,m.t2,m.t3));}
  function realMatch(t,q){return hit(q,t.user)||t.members.some(m=>hit(q,m.gen,m.t2,m.t3,m.u1,m.u2));}

  /* ---------- 描画 ---------- */
  function memRows(t,real){
    return t.members.slice().sort((a,b)=>(POSORD[a.pos]??9)-(POSORD[b.pos]??9)).map(m=>
      '<tr><td>'+esc(m.pos)+'</td><td class="g"><div class="gcell"><span>'+esc(dispGen(m.gen))+'</span>'+badge(m.gen)+'</div></td>'+
      '<td>'+slash(m.t2)+'</td><td>'+slash(m.t3)+'</td>'+
      (real ? '<td class="uni"><span>'+esc(m.u1||'')+'</span><span>'+esc(m.u2||'')+'</span></td>'
            : '<td>'+esc(m.treasure)+'</td><td>'+esc(m.ciTiao)+'</td>')+'</tr>').join('');
  }
  function theoryCard(t){
    const tags=[...(t.strongVs||[]).map(x=>'<span class="tag s"><span class="k">強い</span>'+esc(x)+'</span>'),
                ...(t.weakVs||[]).map(x=>'<span class="tag w"><span class="k">弱い</span>'+esc(x)+'</span>')].join('');
    const nm=(t.name_zh&&t.name&&t.name!==t.name_zh&&t.tier!=='スタダ')
      ? esc(t.name_zh)+'<span class="jp">（'+esc(t.name)+'）</span>' : esc(t.name||t.name_zh);
    return '<article class="tcard'+(t.tier==='スタダ'?' suta':'')+'"><div class="head">'+
      '<span class="tier '+tierCls(t.tier)+'">'+esc(t.tier)+'</span><span class="score">'+esc(t.score||'')+'</span>'+
      '<span class="name mincho">'+nm+'</span></div>'+
      (tags?'<div class="tags">'+tags+'</div>':'')+
      '<table class="mem"><thead><tr><th>位置</th><th>武将</th><th>第二戦法</th><th>第三戦法</th><th>宝物</th><th>词条</th></tr></thead><tbody>'+memRows(t,false)+'</tbody></table>'+
      ((t.note&&t.tier!=='スタダ')?'<div class="note">'+esc(t.note)+'</div>':'')+'</article>';
  }
  function realCard(t){
    return '<article class="tcard"><div class="head"><span class="tier REAL">実戦</span>'+
      '<span class="name mincho">'+esc(t.members.map(m=>dispGen(m.gen)).join('・'))+
      '<span class="real-meta">ユーザー名：'+esc(t.user||'—')+' ・ '+esc(t.date||'')+'</span></span></div>'+
      '<table class="mem"><thead><tr><th>位置</th><th>武将</th><th>第二戦法</th><th>第三戦法</th><th>高級兵種</th></tr></thead><tbody>'+memRows(t,true)+'</tbody></table></article>';
  }
  function renderNav(){
    const nav=$('nav');let html='';
    if(tab==='theory'){
      const cnt=k=>k==='ALL'?THEORY.filter(t=>t.tier!=='スタダ').length:THEORY.filter(t=>t.tier===k).length;
      const items=[['T0','T0'],['T0-','T0-'],['T1','T1'],['T2-','T2-'],['スタダ','SUTA'],['ALL','ALL']];
      html=items.map(([k,c])=>'<button class="tnav '+c+'" data-k="'+esc(k)+'" role="tab" aria-selected="'+(tierSel===k)+'">'+
        (k==='ALL'?'<span class="all-label">すべて</span>':k==='スタダ'?'<span class="suta-label">スタダ</span>':esc(k))+' <span class="tn-count">'+cnt(k)+'</span></button>').join('');
    }else{
      const users=[...new Set(REAL.map(t=>t.user).filter(Boolean))];
      html='<button class="tnav ALL" data-k="ALL" role="tab" aria-selected="'+(userSel==='ALL')+'"><span class="all-label">すべて</span> <span class="tn-count">'+REAL.length+'</span></button>'+
        users.map(u=>'<button class="tnav USER" data-k="'+esc(u)+'" role="tab" aria-selected="'+(userSel===u)+'">'+esc(u)+' <span class="tn-count">'+REAL.filter(t=>t.user===u).length+'</span></button>').join('');
    }
    nav.innerHTML=html;
  }
  function render(){
    const q=$('q').value.trim().toLowerCase();const searching=q.length>0;
    let list;
    if(tab==='theory'){
      list=THEORY.filter(t=>searching?theoryMatch(t,q):(tierSel==='ALL'?t.tier!=='スタダ':t.tier===tierSel));
      list.sort((a,b)=>TIER_ORDER.indexOf(a.tier)-TIER_ORDER.indexOf(b.tier)||(parseFloat(b.score||0)-parseFloat(a.score||0)));
    }else{
      list=REAL.filter(t=>searching?realMatch(t,q):(userSel==='ALL'||t.user===userSel));
    }
    document.querySelectorAll('#nav .tnav').forEach(b=>b.classList.toggle('dim',searching));
    $('count').textContent=searching?('「'+$('q').value.trim()+'」の検索結果：'+list.length+'件'):(list.length+' 部隊');
    $('grid').innerHTML=list.length?list.map(tab==='theory'?theoryCard:realCard).join(''):'<div class="jn-empty">該当なし</div>';
  }
  function setTab(name){
    tab=name;
    $('tab-theory').setAttribute('aria-selected',name==='theory');
    $('tab-real').setAttribute('aria-selected',name==='real');
    $('q').placeholder=name==='theory'?'武将名・部隊名・戦法で検索':'武将名・戦法名・ユーザー名で検索';
    renderNav();render();
  }
  function wire(){
    $('tab-theory').addEventListener('click',()=>setTab('theory'));
    $('tab-real').addEventListener('click',()=>setTab('real'));
    $('nav').addEventListener('click',e=>{const b=e.target.closest('.tnav');if(!b)return;
      if(tab==='theory')tierSel=b.dataset.k;else userSel=b.dataset.k;
      $('q').value='';renderNav();render();});
    $('q').addEventListener('input',render);
  }

  /* ---------- 解錠 ---------- */
  let wired=false;
  async function enter(pass){
    const r=await fetch('./teams-db.enc.json',{cache:'no-store'});
    if(!r.ok)throw new Error('data');
    const data=await decryptBlob(await r.json(),pass);
    REAL=data.map(t=>({user:t.user||'',date:t.date||'',members:(t.members||[]).map(m=>({pos:m.pos,gen:m.gen,t2:m.t2||'',t3:m.t3||'',u1:m.u1||'',u2:m.u2||''}))}));
    REAL.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(!THEORY.length&&!(await loadTheory()))$('notice').hidden=false;
    $('gate').hidden=true;$('app').hidden=false;
    setStickyOffset();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(setStickyOffset);
    if(!wired){wire();wired=true;}
    setTab(THEORY.length?'theory':'real');
  }
  $('gateForm').addEventListener('submit',async e=>{
    e.preventDefault();const err=$('gateErr'),pass=$('gatePass').value;err.textContent='確認中…';
    try{await enter(pass);try{sessionStorage.setItem(SKEY,pass);}catch(_){}err.textContent='';}
    catch(x){err.textContent='合言葉が違うか、データを読めませんでした。';}
  });
  (async()=>{let p=null;try{p=sessionStorage.getItem(SKEY);}catch(_){}
    if(p){try{await enter(p);}catch(e){try{sessionStorage.removeItem(SKEY);}catch(_){}}}})();
})();
