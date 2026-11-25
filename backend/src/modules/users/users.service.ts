import bcrypt from 'bcryptjs';
import { AppError } from '../../shared/errors/AppError';
import { type PublicUserDTO, usersRepository } from './users.repository';
import type { CreateUserInput, UpdateUserInput } from './users.schema';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Regras de negócio para gestão administrativa de usuários.
 */
export const usersService = {
  listUsers(): Promise<PublicUserDTO[]> {
    return usersRepository.findAllPublic();
  },

  async createUser(input: CreateUserInput): Promise<PublicUserDTO> {
    const email = input.email.trim().toLowerCase();
    const existing = await usersRepository.findAuthByEmail(email);

    if (existing) {
      throw new AppError('Já existe um usuário cadastrado com este e-mail.', 409);
    }

    const senhaHash = await bcrypt.hash(input.senha, BCRYPT_SALT_ROUNDS);

    return usersRepository.create({
      nome: input.nome.trim(),
      email,
      senhaHash,
      role: input.role,
    });
  },

  async updateUser(
    targetId: number,
    actorId: number,
    input: UpdateUserInput,
  ): Promise<PublicUserDTO> {
    const isSelfDisabling = input.ativo === false;
    const isSelfDemoting = input.role !== undefined && input.role !== 'ADMIN';

    if (targetId === actorId && (isSelfDisabling || isSelfDemoting)) {
      throw new AppError(
        'Não é permitido desativar ou remover privilégios da própria conta.',
        409,
      );
    }

    const existing = await usersRepository.findPublicById(targetId);
    if (!existing) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    return usersRepository.updatePublic(targetId, {
      ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    });
  },

  async resetPassword(targetId: number, novaSenha: string): Promise<{ message: string }> {
    const existing = await usersRepository.findPublicById(targetId);
    if (!existing) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    const senhaHash = await bcrypt.hash(novaSenha, BCRYPT_SALT_ROUNDS);
    await usersRepository.updatePasswordHash(targetId, senhaHash);

    return { message: 'Senha redefinida com sucesso.' };
  },
};
