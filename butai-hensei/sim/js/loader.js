// 合言葉で sim.bin を復号し、中のファイルを展開してから画面（app.js）を起動する
const KEY_STORE = 'stzb_sim_pass';
const ITER = 250000;
const MIME = { js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', csv: 'text/csv' };

const gate = document.getElementById('gate');
const form = document.getElementById('gateForm');
const input = document.getElementById('gatePass');
const remember = document.getElementById('gateRemember');
const msg = document.getElementById('gateMsg');

let packed = null;
async function getPacked() {
  if (!packed) {
    const r = await fetch('sim.bin', { cache: 'no-cache' });
    if (!r.ok) throw new Error('sim.bin が読み込めません');
    packed = new Uint8Array(await r.arrayBuffer());
  }
  return packed;
}

async function unlock(phrase) {
  const buf = await getPacked();
  const salt = buf.slice(0, 16);
  const iv = buf.slice(16, 28);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const gz = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf.slice(28)); // 合言葉が違うとここで失敗
  const plain = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const hlen = new DataView(plain.buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + hlen)));
  const bodyStart = 4 + hlen;
  const urls = {};
  const dec = new TextDecoder();
  const bytes = (p) => {
    const e = header[p];
    if (!e) throw new Error(`ファイルがありません: ${p}`);
    return plain.subarray(bodyStart + e[0], bodyStart + e[0] + e[1]);
  };
  window.SIM = {
    list: () => Object.keys(header),
    bytes,
    text: (p) => dec.decode(bytes(p)),
    url: (p) => {
      if (!urls[p]) {
        const ext = p.split('.').pop();
        urls[p] = URL.createObjectURL(new Blob([bytes(p)], { type: MIME[ext] || 'application/octet-stream' }));
      }
      return urls[p];
    },
  };
}

async function tryOpen(phrase, save) {
  msg.textContent = '開いています…';
  form.querySelector('button').disabled = true;
  try {
    await unlock(phrase);
  } catch (e) {
    form.querySelector('button').disabled = false;
    try { localStorage.removeItem(KEY_STORE); } catch (x) { /* 無視 */ }
    msg.textContent = e instanceof DOMException && e.name === 'OperationError'
      ? '合言葉が違います' : `開けませんでした：${e.message}`;
    return;
  }
  if (save) { try { localStorage.setItem(KEY_STORE, phrase); } catch (x) { /* 保存不可 */ } }
  gate.hidden = true;
  document.getElementById('app').hidden = false;
  await import(window.SIM.url('js/app.js'));
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (input.value) tryOpen(input.value, remember.checked);
});

// 夜/昼は合言葉の画面から編成ボードと同じ設定に合わせる
try { if (localStorage.getItem('stzb_dark') === '1') document.body.classList.add('dark'); } catch (e) { /* 無視 */ }

let saved = null;
try { saved = localStorage.getItem(KEY_STORE); } catch (e) { /* 無視 */ }
if (saved) tryOpen(saved, true);
else input.focus();
