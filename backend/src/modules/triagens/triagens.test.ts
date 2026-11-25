import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockClienteFindUnique,
  mockCategoriaFindUnique,
  mockItemChecklistFindMany,
  mockTriagemFindMany,
  mockTriagemFindUnique,
  mockTriagemCreate,
  mockTriagemUpdate,
  mockTriagemRespostaFindMany,
  mockTriagemRespostaCount,
  mockTriagemRespostaUpsert,
  mockTriagemRespostaDeleteMany,
  mockTransaction,
} = vi.hoisted(() => {
  const txObj = {
    triagem: {
      update: vi.fn(),
    },
    triagemResposta: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    mockUserFindUnique: vi.fn(),
    mockClienteFindUnique: vi.fn(),
    mockCategoriaFindUnique: vi.fn(),
    mockItemChecklistFindMany: vi.fn(),
    mockTriagemFindMany: vi.fn(),
    mockTriagemFindUnique: vi.fn(),
    mockTriagemCreate: vi.fn(),
    mockTriagemUpdate: vi.fn(),
    mockTriagemRespostaFindMany: vi.fn(),
    mockTriagemRespostaCount: vi.fn(),
    mockTriagemRespostaUpsert: txObj.triagemResposta.upsert,
    mockTriagemRespostaDeleteMany: txObj.triagemResposta.deleteMany,
    mockTransaction: vi.fn(async (callback: (tx: typeof txObj) => Promise<unknown>) =>
      callback({
        triagem: {
          update: mockTriagemUpdate,
        },
        triagemResposta: {
          upsert: txObj.triagemResposta.upsert,
          deleteMany: txObj.triagemResposta.deleteMany,
        },
      }),
    ),
  };
});

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: mockTransaction,
    user: {
      findUnique: mockUserFindUnique,
    },
    cliente: {
      findUnique: mockClienteFindUnique,
    },
    categoria: {
      findUnique: mockCategoriaFindUnique,
    },
    itemChecklist: {
      findMany: mockItemChecklistFindMany,
    },
    triagem: {
      findMany: mockTriagemFindMany,
      findUnique: mockTriagemFindUnique,
      create: mockTriagemCreate,
      update: mockTriagemUpdate,
    },
    triagemResposta: {
      findMany: mockTriagemRespostaFindMany,
      count: mockTriagemRespostaCount,
      upsert: mockTriagemRespostaUpsert,
      deleteMany: mockTriagemRespostaDeleteMany,
    },
  },
}));

import { app } from '../../app';
import { env } from '../../config/env';
import { gerarResumoClienteSugestao, normalizarSerial } from './triagem.utils';

const ADMIN_ACTOR = {
  id: 1,
  nome: 'Administrador BenchOS',
  email: 'admin@benchos.local',
  role: 'ADMIN' as const,
  ativo: true,
};

const FUNCIONARIO_A = {
  id: 2,
  nome: 'Carlos Técnico',
  email: 'carlos@benchos.local',
  role: 'FUNCIONARIO' as const,
  ativo: true,
};

const FUNCIONARIO_B = {
  id: 3,
  nome: 'Mariana Bancada',
  email: 'mariana@benchos.local',
  role: 'FUNCIONARIO' as const,
  ativo: true,
};

function signToken(id: number, role: 'ADMIN' | 'FUNCIONARIO'): string {
  return jwt.sign({ sub: id, role }, env.JWT_SECRET);
}

function makePublicUser(actor: { id: number; nome: string; email: string; role: 'ADMIN' | 'FUNCIONARIO' }) {
  return {
    id: actor.id,
    nome: actor.nome,
    email: actor.email,
    role: actor.role,
  };
}

function makeTriagemRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-25T12:00:00.000Z');
  return {
    id: 10,
    clienteId: 1,
    categoriaId: 1,
    recebidoPorId: FUNCIONARIO_A.id,
    analiseIniciadaPorId: null,
    concluidoPorId: null,
    canceladoPorId: null,
    ultimaAtualizacaoPorId: null,
    modelo: 'WD Purple 4TB',
    fabricante: 'Western Digital',
    numeroSerieMac: '4K08A-370',
    statusSelo: 'INTEGRO',
    observacaoSelo: null,
    defeitoReclamado: 'Não reconhece no DVR',
    acessoriosInclusos: 'Sem acessórios',
    status: 'PENDENTE',
    diagnosticoFinal: null,
    parecerTecnico: null,
    resumoCliente: null,
    criadoEm: now,
    analiseIniciadaEm: null,
    concluidoEm: null,
    canceladoEm: null,
    atualizadoEm: now,
    cliente: {
      id: 1,
      nome: 'Segurança Total Ltda',
      telefone: '11999990000',
      documento: '12345678000199',
      criadoEm: now,
    },
    categoria: {
      id: 1,
      nome: 'HD (Disco Rígido CFTV)',
      icone: 'HardDrive',
      instrucaoGeral: 'Priorize leitura S.M.A.R.T.',
      ativo: true,
    },
    recebidoPor: makePublicUser(FUNCIONARIO_A),
    analiseIniciadaPor: null,
    concluidoPor: null,
    canceladoPor: null,
    ultimaAtualizacaoPor: null,
    ...overrides,
  };
}

describe('Módulo triagens (/api/triagens)', () => {
  const adminToken = signToken(ADMIN_ACTOR.id, 'ADMIN');
  const tokenA = signToken(FUNCIONARIO_A.id, 'FUNCIONARIO');
  const tokenB = signToken(FUNCIONARIO_B.id, 'FUNCIONARIO');

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockClienteFindUnique.mockReset();
    mockCategoriaFindUnique.mockReset();
    mockItemChecklistFindMany.mockReset();
    mockTriagemFindMany.mockReset();
    mockTriagemFindUnique.mockReset();
    mockTriagemCreate.mockReset();
    mockTriagemUpdate.mockReset();
    mockTriagemRespostaFindMany.mockReset();
    mockTriagemRespostaCount.mockReset();
    mockTriagemRespostaUpsert.mockReset();
    mockTriagemRespostaDeleteMany.mockReset();
    mockTransaction.mockClear();
  });

  describe('Utilitários puros (triagem.utils.ts)', () => {
    it('normalizarSerial aplica trim e uppercase', () => {
      expect(normalizarSerial(' 4k08a-370 ')).toBe('4K08A-370');
      expect(normalizarSerial('\t aa:bb:cc:11:22:33 \n')).toBe('AA:BB:CC:11:22:33');
    });

    it('gerarResumoClienteSugestao gera texto legível para cada diagnóstico final', () => {
      const operacional = gerarResumoClienteSugestao({
        diagnosticoFinal: 'OPERACIONAL',
        fabricante: 'Hikvision',
        modelo: 'DS-2CD1023G0E',
      });
      expect(operacional).toContain('Hikvision DS-2CD1023G0E');
      expect(operacional.toLowerCase()).toContain('fonte');

      const defeito = gerarResumoClienteSugestao({
        diagnosticoFinal: 'DEFEITO_FABRICA',
        fabricante: 'Western Digital',
        modelo: 'WD40PURZ',
        itensReprovados: ['Leitura S.M.A.R.T. no PC de bancada'],
      });
      expect(defeito).toContain('Leitura S.M.A.R.T.');

      const especialista = gerarResumoClienteSugestao({
        diagnosticoFinal: 'ENCAMINHAR_ESPECIALISTA',
        fabricante: 'Hikvision',
        modelo: 'DS-7208HGHI',
      });
      expect(especialista.toLowerCase()).toContain('especialista');

      const semGarantia = gerarResumoClienteSugestao({
        diagnosticoFinal: 'SEM_GARANTIA',
        fabricante: 'AGL',
        modelo: 'CA2000',
        statusSelo: 'VIOLADO',
      });
      expect(semGarantia.toLowerCase()).toContain('selo');
      expect(semGarantia.toLowerCase()).toContain('violado');
    });
  });

  describe('Autenticação, listagem e consulta detalhada', () => {
    it('retorna 401 quando usuário não está autenticado', async () => {
      const res = await request(app).get('/api/triagens');
      expect(res.status).toBe(401);
    });

    it('GET /api/triagens exclui CANCELADA por padrão e permite incluir quando solicitado', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_A);
      mockTriagemFindMany.mockResolvedValue([makeTriagemRecord()]);

      const defaultRes = await request(app)
        .get('/api/triagens')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(defaultRes.status).toBe(200);
      expect(mockTriagemFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { status: { not: 'CANCELADA' } },
          orderBy: { criadoEm: 'desc' },
        }),
      );
      expect(JSON.stringify(defaultRes.body)).not.toContain('senhaHash');

      mockTriagemFindMany.mockResolvedValue([]);
      const includeCanceledRes = await request(app)
        .get('/api/triagens?incluirCanceladas=true&busca=%204k08a%20')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(includeCanceledRes.status).toBe(200);
      expect(mockTriagemFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
      const lastWhere = mockTriagemFindMany.mock.calls.at(-1)?.[0]?.where;
      expect(lastWhere.status).toBeUndefined();

      const onlyCanceledRes = await request(app)
        .get('/api/triagens?status=CANCELADA')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(onlyCanceledRes.status).toBe(200);
      expect(mockTriagemFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { status: 'CANCELADA' },
        }),
      );
    });

    it('GET /api/triagens/:id retorna { triagem, itensChecklist, respostas } incluindo itens já respondidos mesmo se desativados', async () => {
      const triagem = makeTriagemRecord({ id: 15, status: 'EM_ANALISE' });
      const respostas = [
        {
          id: 100,
          triagemId: 15,
          itemChecklistId: 99,
          resultado: 'APROVADO',
          observacao: 'Item antigo desativado após resposta',
          respondidoPorId: FUNCIONARIO_A.id,
          respondidoPor: makePublicUser(FUNCIONARIO_A),
          atualizadoEm: new Date('2026-11-25T12:10:00.000Z'),
        },
      ];
      const itensChecklist = [
        {
          id: 1,
          categoriaId: 1,
          descricao: 'Inspeção física',
          comoTestar: 'Checar pinos SATA.',
          ordem: 1,
          ativo: true,
        },
        {
          id: 99,
          categoriaId: 1,
          descricao: 'Item legado respondido',
          comoTestar: 'Conferência anterior.',
          ordem: 2,
          ativo: false,
        },
      ];

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(triagem);
      mockTriagemRespostaFindMany.mockResolvedValueOnce(respostas);
      mockItemChecklistFindMany.mockResolvedValueOnce(itensChecklist);

      const res = await request(app)
        .get('/api/triagens/15')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.triagem.id).toBe(15);
      expect(res.body.itensChecklist).toHaveLength(2);
      expect(res.body.respostas).toHaveLength(1);
      expect(mockItemChecklistFindMany).toHaveBeenCalledWith({
        where: {
          OR: [{ categoriaId: 1, ativo: true }, { id: { in: [99] } }],
        },
        orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      });
    });

    it('GET /api/triagens/:id retorna 404 quando triagem não existe', async () => {
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/triagens/999')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Regras principais de negócio (Review Focus #1, #3 e #4)', () => {
    it('normaliza numeroSerieMac em criarTriagem e exclui CANCELADA da busca de reincidencia', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_A);
      mockClienteFindUnique.mockResolvedValueOnce({ id: 1, nome: 'Cliente Fixo' });
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 1, nome: 'HD', ativo: true });
      mockTriagemCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        makeTriagemRecord({
          id: 21,
          numeroSerieMac: data.numeroSerieMac,
          statusSelo: data.statusSelo,
          status: data.status,
          recebidoPorId: data.recebidoPorId,
        }),
      );

      const createRes = await request(app)
        .post('/api/triagens')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          clienteId: 1,
          categoriaId: 1,
          modelo: 'WD40PURZ',
          fabricante: 'Western Digital',
          numeroSerieMac: ' 4k08a-370 ',
          statusSelo: 'VIOLADO',
          observacaoSelo: 'Lacre rompido no canto superior',
          defeitoReclamado: 'Sem imagem',
        });

      expect(createRes.status).toBe(201);
      expect(mockTriagemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            numeroSerieMac: '4K08A-370',
            status: 'PENDENTE',
            recebidoPorId: FUNCIONARIO_A.id,
            statusSelo: 'VIOLADO',
          }),
        }),
      );
      expect(createRes.body.numeroSerieMac).toBe('4K08A-370');

      const reincidenciaMock = [
        makeTriagemRecord({
          id: 5,
          numeroSerieMac: '4K08A-370',
          status: 'CONCLUIDA',
          diagnosticoFinal: 'OPERACIONAL',
          resumoCliente: 'Equipamento OK.',
        }),
      ];
      mockTriagemFindMany.mockResolvedValueOnce(reincidenciaMock);

      const reincidenciaRes = await request(app)
        .get('/api/triagens/reincidencia?serial=%204k08a-370%20&excluirTriagemId=21')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(reincidenciaRes.status).toBe(200);
      expect(reincidenciaRes.body).toHaveLength(1);
      expect(reincidenciaRes.body[0].id).toBe(5);
      expect(mockTriagemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            numeroSerieMac: '4K08A-370',
            status: { not: 'CANCELADA' },
            id: { not: 21 },
          },
          orderBy: { criadoEm: 'desc' },
        }),
      );
    });

    it('preserva analiseIniciadaPorId original quando outro funcionario conclui a OS em EM_ANALISE', async () => {
      const inicioOriginal = new Date('2026-11-25T10:00:00.000Z');
      const pendente = makeTriagemRecord({ id: 30, status: 'PENDENTE' });
      const emAnalisePorA = makeTriagemRecord({
        id: 30,
        status: 'EM_ANALISE',
        analiseIniciadaPorId: FUNCIONARIO_A.id,
        analiseIniciadaPor: makePublicUser(FUNCIONARIO_A),
        analiseIniciadaEm: inicioOriginal,
      });

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(pendente);
      mockTriagemUpdate.mockResolvedValueOnce(emAnalisePorA);

      const iniciarRes = await request(app)
        .patch('/api/triagens/30/iniciar')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(iniciarRes.status).toBe(200);
      expect(mockTriagemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 30 },
          data: expect.objectContaining({
            status: 'EM_ANALISE',
            analiseIniciadaPorId: FUNCIONARIO_A.id,
          }),
        }),
      );

      // Funcionário B abre a bancada (chama iniciar novamente) -> preserva A
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_B);
      mockTriagemFindUnique.mockResolvedValueOnce(emAnalisePorA);
      mockTriagemUpdate.mockClear();

      const reabrirBancadaRes = await request(app)
        .patch('/api/triagens/30/iniciar')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(reabrirBancadaRes.status).toBe(200);
      expect(reabrirBancadaRes.body.analiseIniciadaPorId).toBe(FUNCIONARIO_A.id);
      expect(mockTriagemUpdate).not.toHaveBeenCalled();

      // Funcionário B conclui a OS iniciada por A -> preserva A em analiseIniciadaPorId/Em e grava B em concluidoPorId
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_B);
      mockTriagemFindUnique.mockResolvedValueOnce(emAnalisePorA);
      mockItemChecklistFindMany.mockResolvedValue([
        { id: 1, categoriaId: 1, descricao: 'Inspeção física', comoTestar: '...', ordem: 1, ativo: true },
        { id: 2, categoriaId: 1, descricao: 'Leitura S.M.A.R.T.', comoTestar: '...', ordem: 2, ativo: true },
      ]);
      mockTriagemRespostaFindMany.mockResolvedValueOnce([
        {
          id: 1,
          triagemId: 30,
          itemChecklistId: 1,
          resultado: 'APROVADO',
          observacao: null,
          respondidoPorId: FUNCIONARIO_A.id,
        },
      ]);
      mockTriagemRespostaUpsert.mockResolvedValue({});
      mockTriagemUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...emAnalisePorA,
        ...data,
        concluidoPor: makePublicUser(FUNCIONARIO_B),
        ultimaAtualizacaoPor: makePublicUser(FUNCIONARIO_B),
      }));

      const concluirRes = await request(app)
        .patch('/api/triagens/30/concluir')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          diagnosticoFinal: 'OPERACIONAL',
          parecerTecnico: 'Disco aprovado em todos os testes de bancada.',
          respostas: [
            {
              itemChecklistId: 2,
              resultado: 'APROVADO',
              observacao: 'S.M.A.R.T. Saudável, 320h ligadas, 0 setores pendentes.',
            },
          ],
        });

      expect(concluirRes.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTriagemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 30 },
          data: expect.objectContaining({
            status: 'CONCLUIDA',
            analiseIniciadaPorId: FUNCIONARIO_A.id,
            analiseIniciadaEm: inicioOriginal,
            concluidoPorId: FUNCIONARIO_B.id,
            ultimaAtualizacaoPorId: FUNCIONARIO_B.id,
          }),
        }),
      );
      expect(concluirRes.body.resumoCliente).toBeTruthy();
    });

    it('salva progresso parcial em EM_ANALISE permitindo respostas PENDENTE e observacoes S.M.A.R.T.', async () => {
      const pendente = makeTriagemRecord({ id: 31, status: 'PENDENTE' });

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(pendente);
      mockItemChecklistFindMany.mockResolvedValueOnce([
        { id: 1, categoriaId: 1 },
        { id: 2, categoriaId: 1 },
      ]);
      mockTriagemRespostaUpsert.mockResolvedValue({});
      mockTriagemUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...pendente,
        ...data,
        ultimaAtualizacaoPor: makePublicUser(FUNCIONARIO_A),
      }));

      const res = await request(app)
        .patch('/api/triagens/31/progresso')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: null,
          parecerTecnico: 'Aguardando conclusão do teste de superfície.',
          respostas: [
            {
              itemChecklistId: 1,
              resultado: 'APROVADO',
              observacao: 'Sem oxidação nos conectores SATA.',
            },
            {
              itemChecklistId: 2,
              resultado: 'PENDENTE',
              observacao: 'S.M.A.R.T. Alerta: 18400h, 4 setores pendentes. Testar gravação 10min.',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTriagemRespostaUpsert).toHaveBeenCalledTimes(2);
      expect(mockTriagemRespostaUpsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            triagemId_itemChecklistId: {
              triagemId: 31,
              itemChecklistId: 2,
            },
          },
          create: expect.objectContaining({
            resultado: 'PENDENTE',
            observacao: 'S.M.A.R.T. Alerta: 18400h, 4 setores pendentes. Testar gravação 10min.',
            respondidoPorId: FUNCIONARIO_A.id,
          }),
        }),
      );
      expect(mockTriagemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 31 },
          data: expect.objectContaining({
            status: 'EM_ANALISE',
            analiseIniciadaPorId: FUNCIONARIO_A.id,
            ultimaAtualizacaoPorId: FUNCIONARIO_A.id,
            parecerTecnico: 'Aguardando conclusão do teste de superfície.',
          }),
        }),
      );
    });

    it('rejeita 400 no progresso parcial quando itemChecklistId pertence a outra categoria', async () => {
      const emAnalise = makeTriagemRecord({ id: 32, categoriaId: 1, status: 'EM_ANALISE' });

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(emAnalise);
      mockItemChecklistFindMany.mockResolvedValueOnce([]); // Item 999 não pertence à categoria 1

      const res = await request(app)
        .patch('/api/triagens/32/progresso')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          respostas: [{ itemChecklistId: 999, resultado: 'APROVADO' }],
        });

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('retorna 409 ao tentar alterar categoriaId em EM_ANALISE com respostas parciais sem confirmar limpeza', async () => {
      const emAnalise = makeTriagemRecord({ id: 40, categoriaId: 1, status: 'EM_ANALISE' });

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(emAnalise);
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 2, nome: 'Câmera Hikvision / HiLook' });
      mockTriagemRespostaCount.mockResolvedValueOnce(2);

      const res = await request(app)
        .patch('/api/triagens/40')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          categoriaId: 2,
          numeroSerieMac: '  cam-999 ',
        });

      expect(res.status).toBe(409);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockTriagemUpdate).not.toHaveBeenCalled();
    });

    it('limpa respostas anteriores na transacao ao alterar categoriaId com limparRespostasAnteriores=true', async () => {
      const emAnalise = makeTriagemRecord({ id: 41, categoriaId: 1, status: 'EM_ANALISE' });

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(emAnalise);
      mockCategoriaFindUnique.mockResolvedValueOnce({ id: 2, nome: 'Câmera Hikvision / HiLook' });
      mockTriagemRespostaCount.mockResolvedValueOnce(2);
      mockTriagemRespostaDeleteMany.mockResolvedValueOnce({ count: 2 });
      mockTriagemUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...emAnalise,
        ...data,
      }));

      const res = await request(app)
        .patch('/api/triagens/41')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          categoriaId: 2,
          numeroSerieMac: '  cam-999 ',
          limparRespostasAnteriores: true,
        });

      expect(res.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTriagemRespostaDeleteMany).toHaveBeenCalledWith({
        where: { triagemId: 41 },
      });
      expect(mockTriagemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 41 },
          data: expect.objectContaining({
            categoriaId: 2,
            numeroSerieMac: 'CAM-999',
            ultimaAtualizacaoPorId: FUNCIONARIO_A.id,
          }),
        }),
      );
    });

    it('rejeita 400 concluirTriagem com itens PENDENTE para OPERACIONAL ou DEFEITO_FABRICA', async () => {
      const emAnalise = makeTriagemRecord({ id: 50, status: 'EM_ANALISE', statusSelo: 'INTEGRO' });
      const activeItems = [
        { id: 1, categoriaId: 1, descricao: 'Item 1', comoTestar: '...', ordem: 1, ativo: true },
        { id: 2, categoriaId: 1, descricao: 'Item 2', comoTestar: '...', ordem: 2, ativo: true },
      ];

      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValue(emAnalise);
      mockItemChecklistFindMany.mockResolvedValue(activeItems);
      mockTriagemRespostaFindMany.mockResolvedValue([]);

      const operacionalRes = await request(app)
        .patch('/api/triagens/50/concluir')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: 'OPERACIONAL',
          respostas: [
            { itemChecklistId: 1, resultado: 'APROVADO' },
            { itemChecklistId: 2, resultado: 'PENDENTE' },
          ],
        });

      expect(operacionalRes.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();

      const defeitoRes = await request(app)
        .patch('/api/triagens/50/concluir')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: 'DEFEITO_FABRICA',
          respostas: [{ itemChecklistId: 1, resultado: 'REPROVADO' }], // Item 2 faltando
        });

      expect(defeitoRes.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();

      const especialistaRes = await request(app)
        .patch('/api/triagens/50/concluir')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: 'ENCAMINHAR_ESPECIALISTA',
          respostas: [{ itemChecklistId: 1, resultado: 'REPROVADO' }],
        });

      expect(especialistaRes.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('aceita concluirTriagem como SEM_GARANTIA sem todos os itens testados apenas quando statusSelo != INTEGRO, convertendo PENDENTE em NAO_TESTADO', async () => {
      const seloIntegro = makeTriagemRecord({ id: 60, status: 'PENDENTE', statusSelo: 'INTEGRO' });
      const seloViolado = makeTriagemRecord({
        id: 61,
        status: 'EM_ANALISE',
        statusSelo: 'VIOLADO',
        analiseIniciadaPorId: FUNCIONARIO_A.id,
        analiseIniciadaEm: new Date('2026-11-25T09:00:00.000Z'),
      });
      const activeItems = [
        { id: 1, categoriaId: 1, descricao: 'Inspeção física', comoTestar: '...', ordem: 1, ativo: true },
        { id: 2, categoriaId: 1, descricao: 'Leitura S.M.A.R.T.', comoTestar: '...', ordem: 2, ativo: true },
        { id: 3, categoriaId: 1, descricao: 'Teste prático', comoTestar: '...', ordem: 3, ativo: true },
      ];

      // Com selo INTEGRO e itens incompletos -> 400
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(seloIntegro);
      mockItemChecklistFindMany.mockResolvedValue(activeItems);
      mockTriagemRespostaFindMany.mockResolvedValueOnce([]);

      const rejectIntegro = await request(app)
        .patch('/api/triagens/60/concluir')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: 'SEM_GARANTIA',
          respostas: [{ itemChecklistId: 1, resultado: 'REPROVADO', observacao: 'Selo íntegro?' }],
        });

      expect(rejectIntegro.status).toBe(400);
      expect(rejectIntegro.body.error.toLowerCase()).toContain('selo');
      expect(mockTransaction).not.toHaveBeenCalled();

      // Com selo VIOLADO -> aceita e converte PENDENTE/faltantes em NAO_TESTADO na transação
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_B);
      mockTriagemFindUnique.mockResolvedValueOnce(seloViolado);
      mockItemChecklistFindMany.mockResolvedValue(activeItems);
      mockTriagemRespostaFindMany.mockResolvedValueOnce([
        {
          id: 500,
          triagemId: 61,
          itemChecklistId: 1,
          resultado: 'REPROVADO',
          observacao: 'Selo da loja rompido.',
          respondidoPorId: FUNCIONARIO_A.id,
        },
        {
          id: 501,
          triagemId: 61,
          itemChecklistId: 2,
          resultado: 'PENDENTE',
          observacao: 'Aguardando validação',
          respondidoPorId: FUNCIONARIO_A.id,
        },
      ]);
      mockTriagemRespostaUpsert.mockResolvedValue({});
      mockTriagemUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...seloViolado,
        ...data,
        concluidoPor: makePublicUser(FUNCIONARIO_B),
      }));

      const acceptViolado = await request(app)
        .patch('/api/triagens/61/concluir')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          diagnosticoFinal: 'SEM_GARANTIA',
          parecerTecnico: 'Garantia recusada conforme selo violado.',
        });

      expect(acceptViolado.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTriagemRespostaUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { triagemId_itemChecklistId: { triagemId: 61, itemChecklistId: 2 } },
          update: expect.objectContaining({
            resultado: 'NAO_TESTADO',
            observacao: 'Aguardando validação',
          }),
        }),
      );
      expect(mockTriagemRespostaUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { triagemId_itemChecklistId: { triagemId: 61, itemChecklistId: 3 } },
          create: expect.objectContaining({
            resultado: 'NAO_TESTADO',
            respondidoPorId: FUNCIONARIO_B.id,
          }),
        }),
      );
      expect(acceptViolado.body.status).toBe('CONCLUIDA');
      expect(acceptViolado.body.diagnosticoFinal).toBe('SEM_GARANTIA');
      expect(acceptViolado.body.resumoCliente).toContain('violado');
    });

    it('retorna 409 quando qualquer usuario tenta editar, salvar progresso, cancelar ou concluir OS ja CONCLUIDA ou CANCELADA, e 403 quando FUNCIONARIO tenta reabrir', async () => {
      const concluida = makeTriagemRecord({ id: 70, status: 'CONCLUIDA', diagnosticoFinal: 'OPERACIONAL' });
      const cancelada = makeTriagemRecord({ id: 71, status: 'CANCELADA' });

      // Mesmo ADMIN não pode editar, salvar progresso, cancelar ou concluir OS já CONCLUIDA/CANCELADA
      mockUserFindUnique.mockResolvedValue(ADMIN_ACTOR);
      mockTriagemFindUnique.mockResolvedValue(concluida);

      const editConcluida = await request(app)
        .patch('/api/triagens/70')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ modelo: 'Outro Modelo' });
      expect(editConcluida.status).toBe(409);

      const progressoConcluida = await request(app)
        .patch('/api/triagens/70/progresso')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parecerTecnico: 'Tentativa pós-fechamento' });
      expect(progressoConcluida.status).toBe(409);

      const cancelarConcluida = await request(app)
        .patch('/api/triagens/70/cancelar')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(cancelarConcluida.status).toBe(409);

      const concluirConcluida = await request(app)
        .patch('/api/triagens/70/concluir')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ diagnosticoFinal: 'OPERACIONAL' });
      expect(concluirConcluida.status).toBe(409);

      mockTriagemFindUnique.mockResolvedValue(cancelada);
      const iniciarCancelada = await request(app)
        .patch('/api/triagens/71/iniciar')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(iniciarCancelada.status).toBe(409);

      const editCancelada = await request(app)
        .patch('/api/triagens/71')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ modelo: 'Outro' });
      expect(editCancelada.status).toBe(409);

      // FUNCIONARIO tentando reabrir -> 403
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      const reabrirFuncionario = await request(app)
        .patch('/api/triagens/70/reabrir')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(reabrirFuncionario.status).toBe(403);
      expect(mockTriagemUpdate).not.toHaveBeenCalled();
    });

    it('permite somente ADMIN reabrir OS CONCLUIDA para EM_ANALISE e permite cancelar OS aberta', async () => {
      const aberta = makeTriagemRecord({ id: 80, status: 'PENDENTE' });
      const concluida = makeTriagemRecord({
        id: 81,
        status: 'CONCLUIDA',
        analiseIniciadaPorId: FUNCIONARIO_A.id,
        concluidoPorId: FUNCIONARIO_B.id,
        concluidoEm: new Date('2026-11-25T13:00:00.000Z'),
      });

      // Cancelamento lógico de OS aberta
      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(aberta);
      mockTriagemUpdate.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
        ...aberta,
        ...data,
        canceladoPor: makePublicUser(FUNCIONARIO_A),
      }));

      const cancelarRes = await request(app)
        .patch('/api/triagens/80/cancelar')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(cancelarRes.status).toBe(200);
      expect(cancelarRes.body.status).toBe('CANCELADA');
      expect(cancelarRes.body.canceladoPorId).toBe(FUNCIONARIO_A.id);

      // ADMIN tentando reabrir OS ainda EM_ANALISE -> 409
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockTriagemFindUnique.mockResolvedValueOnce(makeTriagemRecord({ id: 82, status: 'EM_ANALISE' }));
      const reabrirNaoConcluida = await request(app)
        .patch('/api/triagens/82/reabrir')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reabrirNaoConcluida.status).toBe(409);

      // ADMIN reabrindo OS CONCLUIDA -> 200 EM_ANALISE
      mockUserFindUnique.mockResolvedValueOnce(ADMIN_ACTOR);
      mockTriagemFindUnique.mockResolvedValueOnce(concluida);
      mockTriagemUpdate.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
        ...concluida,
        ...data,
        concluidoPor: null,
        ultimaAtualizacaoPor: makePublicUser(ADMIN_ACTOR),
      }));

      const reabrirRes = await request(app)
        .patch('/api/triagens/81/reabrir')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reabrirRes.status).toBe(200);
      expect(mockTriagemUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 81 },
          data: {
            status: 'EM_ANALISE',
            concluidoPorId: null,
            concluidoEm: null,
            ultimaAtualizacaoPorId: ADMIN_ACTOR.id,
          },
        }),
      );
      expect(reabrirRes.body.status).toBe('EM_ANALISE');
      expect(reabrirRes.body.concluidoPorId).toBeNull();
      expect(reabrirRes.body.concluidoEm).toBeNull();
      expect(reabrirRes.body.ultimaAtualizacaoPorId).toBe(ADMIN_ACTOR.id);
    });
  });

  describe('Validações e casos de borda adicionais', () => {
    it('retorna 400 para parâmetros inválidos e 404 quando cliente ou categoria não existem', async () => {
      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_A);

      const invalidIdRes = await request(app)
        .get('/api/triagens/nao-eh-numero')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(invalidIdRes.status).toBe(400);

      const missingSerialRes = await request(app)
        .get('/api/triagens/reincidencia?serial=%20%20')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(missingSerialRes.status).toBe(400);

      const invalidCreateRes = await request(app)
        .post('/api/triagens')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clienteId: 1 });
      expect(invalidCreateRes.status).toBe(400);

      mockClienteFindUnique.mockResolvedValueOnce(null);
      const clienteNotFoundRes = await request(app)
        .post('/api/triagens')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          clienteId: 999,
          categoriaId: 1,
          modelo: 'DS-7208',
          fabricante: 'Hikvision',
          numeroSerieMac: 'SN123',
          statusSelo: 'INTEGRO',
          defeitoReclamado: 'Não liga',
        });
      expect(clienteNotFoundRes.status).toBe(404);

      mockClienteFindUnique.mockResolvedValueOnce({ id: 1, nome: 'Cliente OK' });
      mockCategoriaFindUnique.mockResolvedValueOnce(null);
      const categoriaNotFoundRes = await request(app)
        .post('/api/triagens')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          clienteId: 1,
          categoriaId: 999,
          modelo: 'DS-7208',
          fabricante: 'Hikvision',
          numeroSerieMac: 'SN123',
          statusSelo: 'INTEGRO',
          defeitoReclamado: 'Não liga',
        });
      expect(categoriaNotFoundRes.status).toBe(404);

      mockTriagemFindUnique.mockResolvedValueOnce(makeTriagemRecord({ id: 90, status: 'PENDENTE' }));
      mockClienteFindUnique.mockResolvedValueOnce(null);
      const patchClienteNotFound = await request(app)
        .patch('/api/triagens/90')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ clienteId: 888 });
      expect(patchClienteNotFound.status).toBe(404);
    });

    it('rejeita itemChecklistId duplicado em progresso e preserva analiseIniciadaPorId quando já está EM_ANALISE', async () => {
      const inicioOriginal = new Date('2026-11-25T08:00:00.000Z');
      const emAnalise = makeTriagemRecord({
        id: 95,
        status: 'EM_ANALISE',
        analiseIniciadaPorId: FUNCIONARIO_A.id,
        analiseIniciadaPor: makePublicUser(FUNCIONARIO_A),
        analiseIniciadaEm: inicioOriginal,
      });

      mockUserFindUnique.mockResolvedValue(FUNCIONARIO_B);
      mockTriagemFindUnique.mockResolvedValue(emAnalise);

      const dupRes = await request(app)
        .patch('/api/triagens/95/progresso')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          respostas: [
            { itemChecklistId: 1, resultado: 'APROVADO' },
            { itemChecklistId: 1, resultado: 'REPROVADO' },
          ],
        });
      expect(dupRes.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();

      mockItemChecklistFindMany.mockResolvedValueOnce([{ id: 1, categoriaId: 1 }]);
      mockTriagemRespostaUpsert.mockResolvedValueOnce({});
      mockTriagemUpdate.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
        ...emAnalise,
        ...data,
        ultimaAtualizacaoPor: makePublicUser(FUNCIONARIO_B),
      }));

      const okRes = await request(app)
        .patch('/api/triagens/95/progresso')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          respostas: [{ itemChecklistId: 1, resultado: 'APROVADO' }],
          diagnosticoFinal: 'OPERACIONAL',
        });

      expect(okRes.status).toBe(200);
      const updateData = mockTriagemUpdate.mock.calls.at(-1)?.[0]?.data;
      expect(updateData.analiseIniciadaPorId).toBeUndefined();
      expect(updateData.analiseIniciadaEm).toBeUndefined();
      expect(updateData.ultimaAtualizacaoPorId).toBe(FUNCIONARIO_B.id);
    });

    it('aceita concluirTriagem como SEM_GARANTIA para statusSelo SEM_SELO e preserva resumoCliente explícito', async () => {
      const semSelo = makeTriagemRecord({
        id: 96,
        status: 'PENDENTE',
        statusSelo: 'SEM_SELO',
      });
      const activeItems = [
        { id: 1, categoriaId: 1, descricao: 'Inspeção', comoTestar: '...', ordem: 1, ativo: true },
      ];

      mockUserFindUnique.mockResolvedValueOnce(FUNCIONARIO_A);
      mockTriagemFindUnique.mockResolvedValueOnce(semSelo);
      mockItemChecklistFindMany.mockResolvedValue(activeItems);
      mockTriagemRespostaFindMany.mockResolvedValueOnce([]);
      mockTriagemRespostaUpsert.mockResolvedValue({});
      mockTriagemUpdate.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({
        ...semSelo,
        ...data,
      }));

      const res = await request(app)
        .patch('/api/triagens/96/concluir')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          diagnosticoFinal: 'SEM_GARANTIA',
          resumoCliente: 'Produto recebido sem selo da loja, não elegível para garantia.',
        });

      expect(res.status).toBe(200);
      expect(res.body.resumoCliente).toBe('Produto recebido sem selo da loja, não elegível para garantia.');
      expect(mockTriagemRespostaUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { triagemId_itemChecklistId: { triagemId: 96, itemChecklistId: 1 } },
          create: expect.objectContaining({ resultado: 'NAO_TESTADO' }),
        }),
      );
    });
  });
});
