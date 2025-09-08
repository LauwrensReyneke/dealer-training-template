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

export async function listTemplates(){
  const { templates = [] } = await request('GET','/templates');
  return templates;
}
export async function getTemplate(key='main'){
  const q = key && key !== 'main' ? `?key=${encodeURIComponent(key)}` : '';
  const { template = '' } = await request('GET', `/template${q}`);
  return template;
}
export function saveTemplate(key, template){
  if (template === undefined) { // backward compat saveTemplate(content)
    return request('PUT','/template',{ template: key });
  }
  return request('PUT','/template',{ key, template });
}
export function deleteTemplate(key){
  return request('DELETE', `/template?key=${encodeURIComponent(key)}`);
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
export function renameTemplate(oldKey, newKey){
  return request('POST', `/rename?oldKey=${encodeURIComponent(oldKey)}&newKey=${encodeURIComponent(newKey)}`);
}
export function deleteDealer(id){
  return request('DELETE', `/dealer?id=${encodeURIComponent(id)}`);
}
export async function renderDealer(id, templateKey='main'){
  const t = templateKey && templateKey !== 'main' ? `&template=${encodeURIComponent(templateKey)}` : '';
  const { rendered = '' } = await request('GET', `/render?id=${encodeURIComponent(id)}${t}`);
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