import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUserFindUnique, mockClienteFindMany, mockClienteCreate } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockClienteFindMany: vi.fn(),
  mockClienteCreate: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findUnique: mockUserFindUnique,
    },
    cliente: {
      findMany: mockClienteFindMany,
      create: mockClienteCreate,
    },
  },
}));

import { app } from '../../app';
import { env } from '../../config/env';

const FUNCIONARIO_ACTOR = {
  id: 2,
  nome: 'Técnico Bancada',
  email: 'tecnico@benchos.local',
  role: 'FUNCIONARIO' as const,
  ativo: true,
};

function signToken(id: number, role: 'ADMIN' | 'FUNCIONARIO'): string {
  return jwt.sign({ sub: id, role }, env.JWT_SECRET);
}

describe('Módulo clientes (/api/clientes)', () => {
  const funcionarioToken = signToken(FUNCIONARIO_ACTOR.id, 'FUNCIONARIO');

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockClienteFindMany.mockReset();
    mockClienteCreate.mockReset();
  });

  describe('Autenticação', () => {
    it('retorna 401 quando usuário não está autenticado no GET /api/clientes', async () => {
      const res = await request(app).get('/api/clientes');
      expect(res.status).toBe(401);
    });

    it('retorna 401 quando usuário não está autenticado no POST /api/clientes', async () => {
      const res = await request(app).post('/api/clientes').send({ nome: 'Cliente Teste' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clientes', () => {
    it('usuário autenticado lista clientes ordenados sem filtro quando busca está ausente', async () => {
      const criadoEm = new Date('2026-11-25T10:00:00.000Z');
      const clientes = [
        {
          id: 1,
          nome: 'Ana Paula',
          telefone: '11999990000',
          documento: '12345678900',
          criadoEm,
        },
      ];

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);
      mockClienteFindMany.mockResolvedValue(clientes);

      const res = await request(app)
        .get('/api/clientes')
        .set('Authorization', `Bearer ${funcionarioToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          ...clientes[0],
          criadoEm: criadoEm.toISOString(),
        },
      ]);
      expect(mockClienteFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { nome: 'asc' },
      });
    });

    it('filtra clientes por nome, telefone ou documento com ?busca= case-insensitive', async () => {
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);
      mockClienteFindMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/clientes?busca=%20Hikvision%20')
        .set('Authorization', `Bearer ${funcionarioToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(mockClienteFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nome: { contains: 'Hikvision', mode: 'insensitive' } },
            { telefone: { contains: 'Hikvision', mode: 'insensitive' } },
            { documento: { contains: 'Hikvision', mode: 'insensitive' } },
          ],
        },
        orderBy: { nome: 'asc' },
      });
    });
  });

  describe('POST /api/clientes', () => {
    it('usuário autenticado cria cliente com nome normalizado (trim) e retorna 201', async () => {
      const criadoEm = new Date('2026-11-25T11:00:00.000Z');
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);
      mockClienteCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 10,
        nome: data.nome,
        telefone: data.telefone ?? null,
        documento: data.documento ?? null,
        criadoEm,
      }));

      const res = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({
          nome: '  Carlos Eduardo  ',
          telefone: '  (11) 98888-7777  ',
          documento: '  123.456.789-00  ',
        });

      expect(res.status).toBe(201);
      expect(mockClienteCreate).toHaveBeenCalledWith({
        data: {
          nome: 'Carlos Eduardo',
          telefone: '(11) 98888-7777',
          documento: '123.456.789-00',
        },
      });
      expect(res.body).toEqual({
        id: 10,
        nome: 'Carlos Eduardo',
        telefone: '(11) 98888-7777',
        documento: '123.456.789-00',
        criadoEm: criadoEm.toISOString(),
      });
    });

    it('cria cliente apenas com nome quando telefone e documento não são informados', async () => {
      const criadoEm = new Date('2026-11-25T11:10:00.000Z');
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);
      mockClienteCreate.mockResolvedValue({
        id: 11,
        nome: 'Loja Central',
        telefone: null,
        documento: null,
        criadoEm,
      });

      const res = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: '  Loja Central  ' });

      expect(res.status).toBe(201);
      expect(mockClienteCreate).toHaveBeenCalledWith({
        data: {
          nome: 'Loja Central',
          telefone: null,
          documento: null,
        },
      });
    });

    it('retorna 400 Zod error quando nome é vazio ou apenas espaços', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_ACTOR);

      const emptyRes = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: '' });

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.error).toBe('Dados inválidos.');

      const spacesRes = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: '   ' });

      expect(spacesRes.status).toBe(400);
      expect(mockClienteCreate).not.toHaveBeenCalled();
    });
  });
});
