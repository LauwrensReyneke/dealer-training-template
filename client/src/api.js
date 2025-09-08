const base = '/api';

async function request(method, path, body){
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(base + path, opts);
  let data = {};
  try { data = await res.json(); } catch {/* ignore */}
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function getTemplate(){
  const { template = '' } = await request('GET','/template');
  return template;
}
export function saveTemplate(template){
  return request('PUT','/template',{ template });
}

export async function listDealers(){
  const { dealers = [] } = await request('GET','/dealers');
  return dealers;
}
export function createDealer(payload){
  return request('POST','/dealer', payload);
}
export function updateDealer(id, payload){
  return request('PUT', `/dealer?id=${encodeURIComponent(id)}`, payload);
}
export function deleteDealer(id){
  return request('DELETE', `/dealer?id=${encodeURIComponent(id)}`);
}
export async function renderDealer(id){
  const { rendered = '' } = await request('GET', `/render?id=${encodeURIComponent(id)}`);
  return rendered;
}

export async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}

