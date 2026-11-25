import { z } from 'zod';

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID de usuário inválido.'),
});

export const createUserSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.').transform((val) => val.toLowerCase()),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres.'),
  role: z.enum(['ADMIN', 'FUNCIONARIO']).default('FUNCIONARIO'),
});

export const updateUserSchema = z
  .object({
    nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres.').optional(),
    role: z.enum(['ADMIN', 'FUNCIONARIO']).optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (data) => data.nome !== undefined || data.role !== undefined || data.ativo !== undefined,
    { message: 'Informe ao menos um campo para atualização.' },
  );

export const resetPasswordSchema = z.object({
  novaSenha: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
