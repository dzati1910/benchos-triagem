import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockCategoriaFindMany,
  mockCategoriaFindUnique,
  mockCategoriaCreate,
  mockCategoriaUpdate,
  mockItemFindUnique,
  mockItemAggregate,
  mockItemCreate,
  mockItemUpdate,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockCategoriaFindMany: vi.fn(),
  mockCategoriaFindUnique: vi.fn(),
  mockCategoriaCreate: vi.fn(),
  mockCategoriaUpdate: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemAggregate: vi.fn(),
  mockItemCreate: vi.fn(),
  mockItemUpdate: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findUnique: mockUserFindUnique,
    },
    categoria: {
      findMany: mockCategoriaFindMany,
      findUnique: mockCategoriaFindUnique,
      create: mockCategoriaCreate,
      update: mockCategoriaUpdate,
    },
    itemChecklist: {
      findUnique: mockItemFindUnique,
      aggregate: mockItemAggregate,
      create: mockItemCreate,
      update: mockItemUpdate,
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
};

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

describe('Módulo categorias (/api/categorias)', () => {
  const adminToken = signToken(ADMIN_ACTOR.id, 'ADMIN');
  const funcionarioToken = signToken(FUNCIONARIO_ACTOR.id, 'FUNCIONARIO');

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockCategoriaFindMany.mockReset();
    mockCategoriaFindUnique.mockReset();
    mockCategoriaCreate.mockReset();
    mockCategoriaUpdate.mockReset();
    mockItemFindUnique.mockReset();
    mockItemAggregate.mockReset();
    mockItemCreate.mockReset();
    mockItemUpdate.mockReset();
  });

  describe('Autenticação e controle de acesso', () => {
    it('retorna 401 quando não autenticado', async () => {
      const res = await request(app).get('/api/categorias');
      expect(res.status).toBe(401);
    });

    it('FUNCIONARIO tentando criar/editar categoria ou itens recebe 403', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_ACTOR);

      const postCat = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: 'NVR', icone: 'Server' });
      expect(postCat.status).toBe(403);

      const patchCat = await request(app)
        .patch('/api/categorias/1')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ nome: 'NVR Pro' });
      expect(patchCat.status).toBe(403);

      const postItem = await request(app)
        .post('/api/categorias/1/itens')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ descricao: 'Item', comoTestar: 'Testar assim' });
      expect(postItem.status).toBe(403);

      const patchItem = await request(app)
        .patch('/api/categorias/itens/10')
        .set('Authorization', `Bearer ${funcionarioToken}`)
        .send({ ativo: false });
      expect(patchItem.status).toBe(403);
    });
  });

  describe('GET /api/categorias', () => {
    it('FUNCIONARIO obtém apenas categorias ativas com itens ativos ordenados por ordem crescente', async () => {
      const categorias = [
        {
          id: 1,
          nome: 'HD CFTV',
          icone: 'HardDrive',
          instrucaoGeral: 'Priorize leitura S.M.A.R.T.',
          ativo: true,
          itens: [
            {
              id: 10,
              categoriaId: 1,
              descricao: 'Inspeção física',
              comoTestar: 'Verificar oxidação e selo.',
              ordem: 1,
              ativo: true,
            },
            {
              id: 11,
              categoriaId: 1,
              descricao: 'Leitura S.M.A.R.T.',
              comoTestar: 'Abrir smartctl.',
              ordem: 2,
              ativo: true,
            },
          ],
        },
      ];

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);
      mockCategoriaFindMany.mockResolvedValue(categorias);

      const res = await request(app)
        .get('/api/categorias')
        .set('Authorization', `Bearer ${funcionarioToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(categorias);
      expect(mockCategoriaFindMany).toHaveBeenCalledWith({
        where: { ativo: true },
        include: {
          itens: {
            where: { ativo: true },
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      });
    });

    it('FUNCIONARIO pedindo ?incluirInativos=true recebe 403', async () => {
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_ACTOR);

      const res = await request(app)
        .get('/api/categorias?incluirInativos=true')
        .set('Authorization', `Bearer ${funcionarioToken}`);

      expect(res.status).toBe(403);
      expect(mockCategoriaFindMany).not.toHaveBeenCalled();
    });

    it('ADMIN pedindo ?incluirInativos=true recebe categorias e itens ativos e inativos ordenados por ordem ASC', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/categorias?incluirInativos=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockCategoriaFindMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          itens: {
            where: undefined,
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      });
    });
  });

  describe('POST /api/categorias', () => {
    it('ADMIN cria categoria e retorna 201', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce(null);
      mockCategoriaCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 5,
        nome: data.nome,
        icone: data.icone,
        instrucaoGeral: data.instrucaoGeral ?? null,
        ativo: true,
      }));

      const res = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: '  Câmera IP  ',
          icone: '  Camera  ',
          instrucaoGeral: '  Testar com switch PoE de bancada.  ',
        });

      expect(res.status).toBe(201);
      expect(mockCategoriaCreate).toHaveBeenCalledWith({
        data: {
          nome: 'Câmera IP',
          icone: 'Camera',
          instrucaoGeral: 'Testar com switch PoE de bancada.',
        },
      });
      expect(res.body).toEqual({
        id: 5,
        nome: 'Câmera IP',
        icone: 'Camera',
        instrucaoGeral: 'Testar com switch PoE de bancada.',
        ativo: true,
      });
    });

    it('retorna 409 se já existir categoria com mesmo nome', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce({
        id: 1,
        nome: 'Câmera IP',
        icone: 'Camera',
        instrucaoGeral: null,
        ativo: true,
      });

      const res = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Câmera IP', icone: 'Camera' });

      expect(res.status).toBe(409);
      expect(mockCategoriaCreate).not.toHaveBeenCalled();
    });

    it('retorna 400 quando dados da categoria são inválidos', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);

      const res = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: '', icone: '' });

      expect(res.status).toBe(400);
      expect(mockCategoriaCreate).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/categorias/:id', () => {
    it('ADMIN edita categoria existente e retorna 200', async () => {
      const existing = {
        id: 3,
        nome: 'DVR',
        icone: 'Server',
        instrucaoGeral: 'Antiga',
        ativo: true,
      };
      const updated = {
        ...existing,
        nome: 'DVR / NVR',
        instrucaoGeral: 'Testar sem HD primeiro.',
        ativo: false,
      };

      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      mockCategoriaUpdate.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/categorias/3')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: '  DVR / NVR  ',
          instrucaoGeral: '  Testar sem HD primeiro.  ',
          ativo: false,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(mockCategoriaUpdate).toHaveBeenCalledWith({
        where: { id: 3 },
        data: {
          nome: 'DVR / NVR',
          instrucaoGeral: 'Testar sem HD primeiro.',
          ativo: false,
        },
      });
    });

    it('retorna 404 quando categoria não existe', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/categorias/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: false });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Categoria não encontrada.' });
      expect(mockCategoriaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/categorias/:id/itens', () => {
    it('ADMIN cria item com comoTestar e ordem explícita retornando 201', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 2, nome: 'Nobreak' });
      mockItemCreate.mockResolvedValue({
        id: 20,
        categoriaId: 2,
        descricao: 'Teste de bateria',
        comoTestar: 'Desligar da tomada com carga resistiva.',
        ordem: 2,
        ativo: true,
      });

      const res = await request(app)
        .post('/api/categorias/2/itens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          descricao: '  Teste de bateria  ',
          comoTestar: '  Desligar da tomada com carga resistiva.  ',
          ordem: 2,
        });

      expect(res.status).toBe(201);
      expect(mockItemAggregate).not.toHaveBeenCalled();
      expect(mockItemCreate).toHaveBeenCalledWith({
        data: {
          categoriaId: 2,
          descricao: 'Teste de bateria',
          comoTestar: 'Desligar da tomada com carga resistiva.',
          ordem: 2,
        },
      });
    });

    it('calcula próxima ordem automaticamente (max + 1) quando ordem é omitida', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 2, nome: 'Nobreak' });
      mockItemAggregate.mockResolvedValueOnce({ _max: { ordem: 4 } });
      mockItemCreate.mockResolvedValue({
        id: 21,
        categoriaId: 2,
        descricao: 'Autonomia',
        comoTestar: 'Medir tempo de sustentação.',
        ordem: 5,
        ativo: true,
      });

      const res = await request(app)
        .post('/api/categorias/2/itens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          descricao: 'Autonomia',
          comoTestar: 'Medir tempo de sustentação.',
        });

      expect(res.status).toBe(201);
      expect(mockItemAggregate).toHaveBeenCalledWith({
        where: { categoriaId: 2 },
        _max: { ordem: true },
      });
      expect(mockItemCreate).toHaveBeenCalledWith({
        data: {
          categoriaId: 2,
          descricao: 'Autonomia',
          comoTestar: 'Medir tempo de sustentação.',
          ordem: 5,
        },
      });
      expect(res.body.ordem).toBe(5);
    });

    it('usa ordem 1 quando categoria ainda não possui itens e ordem é omitida', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 7, nome: 'Fonte' });
      mockItemAggregate.mockResolvedValueOnce({ _max: { ordem: null } });
      mockItemCreate.mockResolvedValue({
        id: 30,
        categoriaId: 7,
        descricao: 'Tensão de saída',
        comoTestar: 'Medir com multímetro em 12V.',
        ordem: 1,
        ativo: true,
      });

      const res = await request(app)
        .post('/api/categorias/7/itens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          descricao: 'Tensão de saída',
          comoTestar: 'Medir com multímetro em 12V.',
        });

      expect(res.status).toBe(201);
      expect(res.body.ordem).toBe(1);
    });

    it('retorna 404 quando categoria não existe ao criar item', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockCategoriaFindUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/categorias/999/itens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          descricao: 'Item órfão',
          comoTestar: 'Não deveria existir.',
        });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Categoria não encontrada.' });
      expect(mockItemCreate).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/categorias/itens/:itemId', () => {
    it('ADMIN reordena e desativa item via PATCH /api/categorias/itens/:itemId', async () => {
      const existingItem = {
        id: 15,
        categoriaId: 1,
        descricao: 'Inspeção',
        comoTestar: 'Checar pinos.',
        ordem: 1,
        ativo: true,
      };
      const updatedItem = {
        ...existingItem,
        ordem: 3,
        ativo: false,
      };

      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockItemFindUnique.mockResolvedValueOnce(existingItem);
      mockItemUpdate.mockResolvedValue(updatedItem);

      const res = await request(app)
        .patch('/api/categorias/itens/15')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ordem: 3, ativo: false });

      expect(res.status).toBe(200);
      expect(mockCategoriaFindUnique).not.toHaveBeenCalled();
      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: 15 },
        data: { ordem: 3, ativo: false },
      });
      expect(res.body).toEqual(updatedItem);
    });

    it('retorna 404 quando item não existe', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockItemFindUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/categorias/itens/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: false });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Item de checklist não encontrado.' });
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it('retorna 400 quando itemId é inválido', async () => {
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);

      const res = await request(app)
        .patch('/api/categorias/itens/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ativo: false });

      expect(res.status).toBe(400);
    });
  });
});
