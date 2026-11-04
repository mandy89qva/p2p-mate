import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('Cloudflare Pages permite que el simulador oficial de QvaPay incruste la app', () => {
  assert.match(headers, /Content-Security-Policy:\s*frame-ancestors 'self' https:\/\/www\.qvapay\.com/i);
  assert.doesNotMatch(headers, /X-Frame-Options:\s*(DENY|SAMEORIGIN)/i);
});

test('se conservan cabeceras de seguridad sin bloquear permisos innecesarios', () => {
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(headers, /Referrer-Policy:\s*strict-origin-when-cross-origin/i);
  assert.match(headers, /Permissions-Policy:.*camera=\(\).*microphone=\(\).*geolocation=\(\)/i);
});

test('la página carga el puente del simulador antes del módulo de la app', () => {
  const sdkPosition = html.indexOf('https://www.qvapay.com/miniapps/sdk-sim.js');
  const appPosition = html.indexOf('type="module" src="./app.js"');
  assert.ok(sdkPosition >= 0 && appPosition > sdkPosition);
});
