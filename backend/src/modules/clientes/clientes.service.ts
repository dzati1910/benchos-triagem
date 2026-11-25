import type { Cliente } from '@prisma/client';
import { clientesRepository } from './clientes.repository';
import type { CreateClienteInput } from './clientes.schema';

/**
 * Regras de negócio para cadastro e listagem de clientes.
 */
export const clientesService = {
  listClientes(busca?: string): Promise<Cliente[]> {
    return clientesRepository.findMany(busca);
  },

  createCliente(input: CreateClienteInput): Promise<Cliente> {
    return clientesRepository.create({
      nome: input.nome.trim(),
      telefone: input.telefone?.trim() || null,
      documento: input.documento?.trim() || null,
    });
  },
};
