import { z } from 'zod';

const STATUS_TRIAGEM_VALUES = ['PENDENTE', 'EM_ANALISE', 'CONCLUIDA', 'CANCELADA'] as const;
const STATUS_SELO_VALUES = ['INTEGRO', 'VIOLADO', 'SEM_SELO'] as const;
const DIAGNOSTICO_FINAL_VALUES = [
  'OPERACIONAL',
  'DEFEITO_FABRICA',
  'ENCAMINHAR_ESPECIALISTA',
  'SEM_GARANTIA',
] as const;
const RESULTADO_ITEM_VALUES = ['PENDENTE', 'APROVADO', 'REPROVADO', 'NAO_TESTADO'] as const;

const emptyToUndefined = (val: unknown): unknown => (val === '' ? undefined : val);

export const triagemIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID de triagem inválido.'),
});

export const listTriagensQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(STATUS_TRIAGEM_VALUES).optional()),
  busca: z.string().trim().optional(),
  incluirCanceladas: z
    .preprocess(emptyToUndefined, z.enum(['true', 'false']).optional())
    .transform((val) => val === 'true'),
});

export const reincidenciaQuerySchema = z.object({
  serial: z.string().trim().min(1, 'Serial/MAC é obrigatório.'),
  excluirTriagemId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive('ID de triagem inválido.').optional(),
  ),
});

export const createTriagemSchema = z.object({
  clienteId: z.number().int().positive('Cliente inválido.'),
  categoriaId: z.number().int().positive('Categoria inválida.'),
  modelo: z.string().trim().min(1, 'Modelo é obrigatório.'),
  fabricante: z.string().trim().min(1, 'Fabricante é obrigatório.'),
  numeroSerieMac: z.string().trim().min(1, 'Número de Série/MAC é obrigatório.'),
  statusSelo: z.enum(STATUS_SELO_VALUES),
  observacaoSelo: z.string().trim().optional().nullable(),
  defeitoReclamado: z.string().trim().min(1, 'Defeito reclamado é obrigatório.'),
  acessoriosInclusos: z.string().trim().optional().nullable(),
});

export const updateTriagemSchema = z
  .object({
    clienteId: z.number().int().positive('Cliente inválido.').optional(),
    categoriaId: z.number().int().positive('Categoria inválida.').optional(),
    modelo: z.string().trim().min(1, 'Modelo é obrigatório.').optional(),
    fabricante: z.string().trim().min(1, 'Fabricante é obrigatório.').optional(),
    numeroSerieMac: z.string().trim().min(1, 'Número de Série/MAC é obrigatório.').optional(),
    statusSelo: z.enum(STATUS_SELO_VALUES).optional(),
    observacaoSelo: z.string().trim().optional().nullable(),
    defeitoReclamado: z.string().trim().min(1, 'Defeito reclamado é obrigatório.').optional(),
    acessoriosInclusos: z.string().trim().optional().nullable(),
    limparRespostasAnteriores: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.clienteId !== undefined ||
      data.categoriaId !== undefined ||
      data.modelo !== undefined ||
      data.fabricante !== undefined ||
      data.numeroSerieMac !== undefined ||
      data.statusSelo !== undefined ||
      data.observacaoSelo !== undefined ||
      data.defeitoReclamado !== undefined ||
      data.acessoriosInclusos !== undefined,
    { message: 'Informe ao menos um campo para atualização.' },
  );

export const respostaChecklistInputSchema = z.object({
  itemChecklistId: z.number().int().positive('ID do item de checklist inválido.'),
  resultado: z.enum(RESULTADO_ITEM_VALUES),
  observacao: z.string().trim().optional().nullable(),
});

export const salvarProgressoSchema = z
  .object({
    respostas: z.array(respostaChecklistInputSchema).optional(),
    diagnosticoFinal: z.enum(DIAGNOSTICO_FINAL_VALUES).optional().nullable(),
    parecerTecnico: z.string().trim().optional().nullable(),
    resumoCliente: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) =>
      data.respostas !== undefined ||
      data.diagnosticoFinal !== undefined ||
      data.parecerTecnico !== undefined ||
      data.resumoCliente !== undefined,
    { message: 'Informe respostas ou rascunho de laudo para salvar o progresso.' },
  );

export const concluirTriagemSchema = z.object({
  diagnosticoFinal: z.enum(DIAGNOSTICO_FINAL_VALUES),
  parecerTecnico: z.string().trim().optional().nullable(),
  resumoCliente: z.string().trim().optional().nullable(),
  respostas: z.array(respostaChecklistInputSchema).optional().default([]),
});

export type ListTriagensQuery = z.infer<typeof listTriagensQuerySchema>;
export type ReincidenciaQuery = z.infer<typeof reincidenciaQuerySchema>;
export type CreateTriagemInput = z.infer<typeof createTriagemSchema>;
export type UpdateTriagemInput = z.infer<typeof updateTriagemSchema>;
export type RespostaChecklistInput = z.infer<typeof respostaChecklistInputSchema>;
export type SalvarProgressoInput = z.infer<typeof salvarProgressoSchema>;
export type ConcluirTriagemInput = z.infer<typeof concluirTriagemSchema>;
