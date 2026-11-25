import { z } from 'zod';

export const listClientesQuerySchema = z.object({
  busca: z.string().trim().optional(),
});

export const createClienteSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do cliente é obrigatório.'),
  telefone: z.string().trim().optional().nullable(),
  documento: z.string().trim().optional().nullable(),
});

export type ListClientesQuery = z.infer<typeof listClientesQuerySchema>;
export type CreateClienteInput = z.infer<typeof createClienteSchema>;
