import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUserFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import { app } from '../../app';
import { env } from '../../config/env';

describe('Módulo auth (/api/auth)', () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
  });

  describe('POST /api/auth/login', () => {
    it('retorna token JWT e usuário sem senhaHash quando credenciais são válidas e ativo=true', async () => {
      const senhaHash = await bcrypt.hash('BenchOS@2026', 4);
      const criadoEm = new Date('2026-11-25T10:00:00.000Z');

      mockUserFindUnique.mockResolvedValue({
        id: 1,
        nome: 'Administrador BenchOS',
        email: 'admin@benchos.local',
        senhaHash,
        role: 'ADMIN',
        ativo: true,
        criadoEm,
      });

      const res = await request(app).post('/api/auth/login').send({
        email: '  Admin@BenchOS.Local ',
        senha: 'BenchOS@2026',
      });

      expect(res.status).toBe(200);
      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'admin@benchos.local' },
        }),
      );
      expect(typeof res.body.token).toBe('string');

      const decoded = jwt.verify(res.body.token, env.JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('ADMIN');

      expect(res.body.user).toEqual({
        id: 1,
        nome: 'Administrador BenchOS',
        email: 'admin@benchos.local',
        role: 'ADMIN',
        ativo: true,
        criadoEm: criadoEm.toISOString(),
      });
      expect(res.body.user).not.toHaveProperty('senhaHash');
    });

    it('retorna 401 quando e-mail não existe', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/login').send({
        email: 'inexistente@benchos.local',
        senha: 'qualquersenha',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });

    it('retorna 401 quando senha está incorreta', async () => {
      const senhaHash = await bcrypt.hash('SenhaCorreta123', 4);
      mockUserFindUnique.mockResolvedValue({
        id: 2,
        nome: 'Técnico Bancada',
        email: 'tecnico@benchos.local',
        senhaHash,
        role: 'FUNCIONARIO',
        ativo: true,
        criadoEm: new Date(),
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'tecnico@benchos.local',
        senha: 'SenhaErrada',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });

    it('retorna 401 com mensagem específica quando usuário está desativado (ativo: false)', async () => {
      const senhaHash = await bcrypt.hash('SenhaCorreta123', 4);
      mockUserFindUnique.mockResolvedValue({
        id: 3,
        nome: 'Ex-Técnico',
        email: 'desativado@benchos.local',
        senhaHash,
        role: 'FUNCIONARIO',
        ativo: false,
        criadoEm: new Date(),
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'desativado@benchos.local',
        senha: 'SenhaCorreta123',
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: 'Usuário desativado. Contate o administrador.',
      });
    });

    it('retorna 400 quando payload de login é inválido', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'email-invalido',
        senha: '',
      });

      expect(res.status).toBe(400);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('retorna PublicUserDTO do usuário autenticado sem senhaHash', async () => {
      const criadoEm = new Date('2026-11-25T10:00:00.000Z');
      const token = jwt.sign({ sub: 1, role: 'ADMIN' }, env.JWT_SECRET);

      mockUserFindUnique.mockResolvedValue({
        id: 1,
        nome: 'Administrador BenchOS',
        email: 'admin@benchos.local',
        role: 'ADMIN',
        ativo: true,
        criadoEm,
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: 1,
          nome: 'Administrador BenchOS',
          email: 'admin@benchos.local',
          role: 'ADMIN',
          ativo: true,
          criadoEm: criadoEm.toISOString(),
        },
      });
      expect(res.body.user).not.toHaveProperty('senhaHash');
    });

    it('retorna 401 quando não autenticado', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Ausência de auto-cadastro público', () => {
    it('POST /api/auth/register não existe e retorna 404', async () => {
      const res = await request(app).post('/api/auth/register').send({
        nome: 'Intruso',
        email: 'intruso@benchos.local',
        senha: 'SenhaForte123',
      });

      expect(res.status).toBe(404);
    });
  });
});
