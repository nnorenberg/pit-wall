// usage: node tools/live_check.mjs file:///path/to/dist/pit-wall.html <window width> "<async JS expression>"
// drive a real-time headless Chrome over the DevTools protocol and run one async test expression
import { spawn } from 'node:child_process';
const [url, width, expr] = [process.argv[2], process.argv[3], process.argv[4]];
const chrome = spawn('chromium', ['--headless=new', '--no-sandbox', '--remote-debugging-port=9333', `--window-size=${width},1000`, '--user-data-dir=' + (process.env.TMPDIR || '/tmp') + '/pitwall-cdp-' + Date.now(), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws; for (let i = 0; i < 50; i++) { try { const l = await (await fetch('http://127.0.0.1:9333/json')).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { } await sleep(200); }
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Page.navigate', { url }); await sleep(4000);
const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(r.result.result ? r.result.result.value : r.result));
chrome.kill(); process.exit(0);
