import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUserFindMany, mockUserFindUnique, mockUserCreate, mockUserUpdate } = vi.hoisted(() => ({
  mockUserFindMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findMany: mockUserFindMany,
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
  },
}));

import { app } from '../../app';
import { env } from '../../config/env';

const ADMIN_ACTOR = {
  id: 1,
  nome: 'Administrador BenchOS',
  email: 'admin@benchos.local',
  role: 'ADMIN' as const,
  ativo: true,
  criadoEm: new Date('2026-11-25T10:00:00.000Z'),
};

const FUNCIONARIO_ACTOR = {
  id: 2,
  nome: 'Técnico Bancada',
  email: 'tecnico@benchos.local',
  role: 'FUNCIONARIO' as const,
  ativo: true,
  criadoEm: new Date('2026-11-25T10:05:00.000Z'),
};

function signToken(id: number, role: 'ADMIN' | 'FUNCIONARIO'): string {
  return jwt.sign({ sub: id, role }, env.JWT_SECRET);
}

describe('Módulo users (/api/users)', () => {
  const adminToken = signToken(ADMIN_ACTOR.id, 'ADMIN');
  const funcionarioToken = signToken(FUNCIONARIO_ACTOR.id, 'FUNCIONARIO');

  beforeEach(() => {
    mockUserFindMany.mockReset();
    mockUserFindUnique.mockReset();
    mockUserCreate.mockReset();
    mockUserUpdate.mockReset();
  });

  describe('Controle de acesso por perfil', () => {
    it('retorna 401 quando usuário não está autenticado', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    it('retorna 403 quando FUNCIONARIO tenta listar, criar, editar ou redefinir senha', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_ACTOR);

      const getRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${funcionarioToken}`);
      expect(getRes.status).toBe(403);

      const postRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({
          nome: 'Novo Usuário',
          email: 'novo@benchos.local',
          senha: 'SenhaForte123',
          role: 'FUNCIONARIO',
        });
      expect(postRes.status).toBe(403);

      const patchRes = await request(app)
        .patch('/api/users/1')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: 'Alterado' });
      expect(patchRes.status).toBe(403);

      const passRes = await request(app)
        .patch('/api/users/1/senha')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ novaSenha: 'NovaSenha123' });
      expect(passRes.status).toBe(403);
    });
  });

  describe('GET /api/users', () => {
    it('ADMIN lista usuários retornando PublicUserDTO[] sem senhaHash', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockUserFindMany.mockResolvedValue([ADMIN_ACTOR, FUNCIONARIO_ACTOR]);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          ...ADMIN_ACTOR,
          criadoEm: ADMIN_ACTOR.criadoEm.toISOString(),
        },
        {
          ...FUNCIONARIO_ACTOR,
          criadoEm: FUNCIONARIO_ACTOR.criadoEm.toISOString(),
        },
      ]);
      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            ativo: true,
            criadoEm: true,
          },
        }),
      );
    });
  });

  describe('POST /api/users', () => {
    it('ADMIN cria usuário com e-mail normalizado, hash bcrypt e retorna 201 sem senhaHash', async () => {
      const criadoEm = new Date('2026-11-25T11:00:00.000Z');
      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number; email?: string } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        if (where.email === 'novo.tecnico@benchos.local') return null;
        return null;
      });
      mockUserCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 10,
        nome: data.nome,
        email: data.email,
        role: data.role,
        ativo: true,
        criadoEm,
      }));

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: '  Novo Técnico  ',
          email: '  Novo.Tecnico@BenchOS.Local  ',
          senha: 'SenhaSegura123',
          role: 'FUNCIONARIO',
        });

      expect(res.status).toBe(201);
      expect(mockUserCreate).toHaveBeenCalledTimes(1);

      const createArg = mockUserCreate.mock.calls[0][0];
      expect(createArg.data.nome).toBe('Novo Técnico');
      expect(createArg.data.email).toBe('novo.tecnico@benchos.local');
      expect(createArg.data.role).toBe('FUNCIONARIO');
      expect(createArg.data.senhaHash).not.toBe('SenhaSegura123');
      expect(await bcrypt.compare('SenhaSegura123', createArg.data.senhaHash)).toBe(true);
      expect(createArg.select).toEqual({
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        criadoEm: true,
      });

      expect(res.body).toEqual({
        id: 10,
        nome: 'Novo Técnico',
        email: 'novo.tecnico@benchos.local',
        role: 'FUNCIONARIO',
        ativo: true,
        criadoEm: criadoEm.toISOString(),
      });
      expect(res.body).not.toHaveProperty('senhaHash');
    });

    it('retorna 409 quando e-mail já está cadastrado', async () => {
      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number; email?: string } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        if (where.email === 'tecnico@benchos.local') return FUNCIONARIO_ACTOR;
        return null;
      });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: 'Outro Técnico',
          email: 'TECNICO@benchos.local',
          senha: 'SenhaSegura123',
          role: 'FUNCIONARIO',
        });

      expect(res.status).toBe(409);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('retorna 400 quando dados de criação são inválidos', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: 'A',
          email: 'invalido',
          senha: '123',
          role: 'SUPERADMIN',
        });

      expect(res.status).toBe(400);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('ADMIN atualiza outro usuário e retorna PublicUserDTO', async () => {
      const updatedUser = {
        ...FUNCIONARIO_ACTOR,
        nome: 'Técnico Sênior',
        ativo: false,
      };

      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        if (where.id === FUNCIONARIO_ACTOR.id) return FUNCIONARIO_ACTOR;
        return null;
      });
      mockUserUpdate.mockResolvedValue(updatedUser);

      const res = await request(app)
        .patch(`/api/users/${FUNCIONARIO_ACTOR.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: 'Técnico Sênior',
          ativo: false,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ...updatedUser,
        criadoEm: FUNCIONARIO_ACTOR.criadoEm.toISOString(),
      });
      expect(res.body).not.toHaveProperty('senhaHash');
    });

    it('ADMIN tentando desativar a própria conta recebe 409', async () => {
      mockUserFindUnique.mockResolvedValue(ADMIN_ACTOR);

      const res = await request(app)
        .patch(`/api/users/${ADMIN_ACTOR.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: false });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'Não é permitido desativar ou remover privilégios da própria conta.',
      });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN tentando rebaixar o próprio perfil para FUNCIONARIO recebe 409', async () => {
      mockUserFindUnique.mockResolvedValue(ADMIN_ACTOR);

      const res = await request(app)
        .patch(`/api/users/${ADMIN_ACTOR.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'FUNCIONARIO' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'Não é permitido desativar ou remover privilégios da própria conta.',
      });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN pode atualizar o próprio nome sem sofrer bloqueio 409', async () => {
      const updatedAdmin = {
        ...ADMIN_ACTOR,
        nome: 'Admin Principal',
      };
      mockUserFindUnique.mockResolvedValue(ADMIN_ACTOR);
      mockUserUpdate.mockResolvedValue(updatedAdmin);

      const res = await request(app)
        .patch(`/api/users/${ADMIN_ACTOR.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Admin Principal' });

      expect(res.status).toBe(200);
      expect(res.body.nome).toBe('Admin Principal');
    });

    it('retorna 404 quando usuário alvo não existe', async () => {
      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        return null;
      });

      const res = await request(app)
        .patch('/api/users/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Inexistente' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Usuário não encontrado.' });
    });

    it('retorna 400 quando parâmetro :id é inválido', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);

      const res = await request(app)
        .patch('/api/users/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Teste' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:id/senha', () => {
    it('ADMIN redefine senha de outro usuário com hash bcrypt e retorna mensagem', async () => {
      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        if (where.id === FUNCIONARIO_ACTOR.id) return FUNCIONARIO_ACTOR;
        return null;
      });
      mockUserUpdate.mockResolvedValue({ id: FUNCIONARIO_ACTOR.id });

      const res = await request(app)
        .patch(`/api/users/${FUNCIONARIO_ACTOR.id}/senha`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ novaSenha: 'NovaSenhaForte123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'Senha redefinida com sucesso.',
      });

      const updateArg = mockUserUpdate.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: FUNCIONARIO_ACTOR.id });
      expect(updateArg.data.senhaHash).not.toBe('NovaSenhaForte123');
      expect(await bcrypt.compare('NovaSenhaForte123', updateArg.data.senhaHash)).toBe(true);
    });

    it('retorna 404 quando usuário alvo não existe ao redefinir senha', async () => {
      mockUserFindUnique.mockImplementation(async ({ where }: { where: { id?: number } }) => {
        if (where.id === ADMIN_ACTOR.id) return ADMIN_ACTOR;
        return null;
      });

      const res = await request(app)
        .patch('/api/users/999/senha')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ novaSenha: 'NovaSenhaForte123' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Usuário não encontrado.' });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('retorna 400 quando novaSenha é muito curta', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);

      const res = await request(app)
        .patch(`/api/users/${FUNCIONARIO_ACTOR.id}/senha`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ novaSenha: '123' });

      expect(res.status).toBe(400);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });
});
