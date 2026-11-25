import { z } from 'zod';

export const categoriaIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID de categoria inválido.'),
});

export const itemIdParamSchema = z.object({
  itemId: z.coerce.number().int().positive('ID de item inválido.'),
});

export const listCategoriasQuerySchema = z.object({
  incluirInativos: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const createCategoriaSchema = z.object({
  nome: z.string().trim().min(1, 'Nome da categoria é obrigatório.'),
  icone: z.string().trim().min(1, 'Ícone da categoria é obrigatório.'),
  instrucaoGeral: z.string().trim().optional().nullable(),
});

export const updateCategoriaSchema = z
  .object({
    nome: z.string().trim().min(1, 'Nome da categoria é obrigatório.').optional(),
    icone: z.string().trim().min(1, 'Ícone da categoria é obrigatório.').optional(),
    instrucaoGeral: z.string().trim().optional().nullable(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.nome !== undefined ||
      data.icone !== undefined ||
      data.instrucaoGeral !== undefined ||
      data.ativo !== undefined,
    { message: 'Informe ao menos um campo para atualização.' },
  );

export const createItemChecklistSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição do item é obrigatória.'),
  comoTestar: z.string().trim().min(1, 'Instrução de como testar é obrigatória.'),
  ordem: z.number().int().positive('Ordem deve ser um número inteiro positivo.').optional(),
});

export const updateItemChecklistSchema = z
  .object({
    descricao: z.string().trim().min(1, 'Descrição do item é obrigatória.').optional(),
    comoTestar: z.string().trim().min(1, 'Instrução de como testar é obrigatória.').optional(),
    ordem: z.number().int().positive('Ordem deve ser um número inteiro positivo.').optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.descricao !== undefined ||
      data.comoTestar !== undefined ||
      data.ordem !== undefined ||
      data.ativo !== undefined,
    { message: 'Informe ao menos um campo para atualização.' },
  );

export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaInput = z.infer<typeof updateCategoriaSchema>;
export type CreateItemChecklistInput = z.infer<typeof createItemChecklistSchema>;
export type UpdateItemChecklistInput = z.infer<typeof updateItemChecklistSchema>;
