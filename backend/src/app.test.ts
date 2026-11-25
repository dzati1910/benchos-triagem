import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('App Express (produção com SPA estática e proteção /api)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function createFakeFrontendDist(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'benchos-dist-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><html><body><div id="root">BenchOS SPA</div></body></html>',
    );
    fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("benchos");');
    return dir;
  }

  it('serve index.html na raiz e em rotas do React Router (fallback SPA)', async () => {
    const distDir = createFakeFrontendDist();
    const prodApp = createApp({ frontendDistDir: distDir });

    const rootRes = await request(prodApp).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers['cache-control']).toBe('no-cache');
    expect(rootRes.text).toContain('BenchOS SPA');

    const deepRouteRes = await request(prodApp).get('/admin/usuarios');
    expect(deepRouteRes.status).toBe(200);
    expect(deepRouteRes.headers['cache-control']).toBe('no-cache');
    expect(deepRouteRes.text).toContain('BenchOS SPA');
  });

  it('serve arquivos estáticos compilados na pasta assets', async () => {
    const distDir = createFakeFrontendDist();
    const prodApp = createApp({ frontendDistDir: distDir });

    const assetRes = await request(prodApp).get('/assets/app.js');
    expect(assetRes.status).toBe(200);
    expect(assetRes.text).toContain('console.log("benchos")');
  });

  it('retorna 404 para assets inexistentes sem devolver index.html', async () => {
    const distDir = createFakeFrontendDist();
    const prodApp = createApp({ frontendDistDir: distDir });

    const missingAsset = await request(prodApp).get('/assets/nao-existe.js');
    expect(missingAsset.status).toBe(404);
  });

  it('normaliza caminho relativo passado em frontendDistDir', async () => {
    const distDir = createFakeFrontendDist();
    const relativeDistDir = path.relative(process.cwd(), distDir);
    const prodApp = createApp({ frontendDistDir: relativeDistDir });

    const res = await request(prodApp).get('/painel');
    expect(res.status).toBe(200);
    expect(res.text).toContain('BenchOS SPA');
  });

  it('retorna 404 JSON para rotas /api inexistentes (GET e POST) mesmo com SPA estática ativa', async () => {
    const distDir = createFakeFrontendDist();
    const prodApp = createApp({ frontendDistDir: distDir });

    const getRes = await request(prodApp).get('/api/rota-que-nao-existe');
    expect(getRes.status).toBe(404);
    expect(getRes.body).toEqual({ error: 'Rota da API não encontrada.' });

    const postRes = await request(prodApp).post('/api/rota-que-nao-existe').send({});
    expect(postRes.status).toBe(404);
    expect(postRes.body).toEqual({ error: 'Rota da API não encontrada.' });
  });
});
