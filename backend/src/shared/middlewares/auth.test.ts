import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

import { env } from '../../config/env';
import { authenticate, requireRole } from './auth';
import { errorHandler } from './errorHandler';

function createTestApp() {
  const testApp = express();
  testApp.use(express.json());

  testApp.get('/privado', authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  testApp.get('/somente-admin', authenticate, requireRole('ADMIN'), (req, res) => {
    res.json({ ok: true, user: req.user });
  });

  testApp.use(errorHandler);
  return testApp;
}

describe('auth middlewares', () => {
  const testApp = createTestApp();

  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('retorna 401 quando Authorization Bearer está ausente ou malformado', async () => {
    const missingRes = await request(testApp).get('/privado');
    expect(missingRes.status).toBe(401);

    const malformedRes = await request(testApp)
      .get('/privado')
      .set('Authorization', 'Basic abc123');
    expect(malformedRes.status).toBe(401);
  });

  it('retorna 401 quando token JWT é inválido', async () => {
    const res = await request(testApp)
      .get('/privado')
      .set('Authorization', 'Bearer token.invalido.aqui');
    expect(res.status).toBe(401);
  });

  it('retorna 401 quando usuário do token foi desativado no banco (ativo: false)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 2,
      nome: 'Joao',
      email: 'j@loja.com',
      role: 'FUNCIONARIO',
      ativo: false,
    });
    const token = jwt.sign({ sub: 2, role: 'FUNCIONARIO' }, env.JWT_SECRET);

    const res = await request(testApp)
      .get('/privado')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
  });

  it('retorna 401 quando usuário do token não existe mais no banco', async () => {
    mockFindUnique.mockResolvedValue(null);
    const token = jwt.sign({ sub: 999, role: 'FUNCIONARIO' }, env.JWT_SECRET);

    const res = await request(testApp)
      .get('/privado')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('retorna 403 quando FUNCIONARIO tenta acessar rota restrita a ADMIN', async () => {
    mockFindUnique.mockResolvedValue({
      id: 2,
      nome: 'Joao',
      email: 'j@loja.com',
      role: 'FUNCIONARIO',
      ativo: true,
    });
    const token = jwt.sign({ sub: 2, role: 'FUNCIONARIO' }, env.JWT_SECRET);

    const res = await request(testApp)
      .get('/somente-admin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('anexa req.user e permite acesso quando usuário ativo tem role permitida', async () => {
    mockFindUnique.mockResolvedValue({
      id: 1,
      nome: 'Admin BenchOS',
      email: 'admin@benchos.local',
      role: 'ADMIN',
      ativo: true,
    });
    const token = jwt.sign({ sub: 1, role: 'ADMIN' }, env.JWT_SECRET);

    const res = await request(testApp)
      .get('/somente-admin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      user: {
        id: 1,
        nome: 'Admin BenchOS',
        email: 'admin@benchos.local',
        role: 'ADMIN',
      },
    });
  });
});
