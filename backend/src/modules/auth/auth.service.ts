import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { type PublicUserDTO, usersRepository } from '../users/users.repository';
import type { LoginInput } from './auth.schema';

export interface LoginResponse {
  token: string;
  user: PublicUserDTO;
}

function toPublicUser(user: PublicUserDTO): PublicUserDTO {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    ativo: user.ativo,
    criadoEm: user.criadoEm,
  };
}

/**
 * Regras de negócio para autenticação controlada via JWT.
 */
export const authService = {
  async login(input: LoginInput): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await usersRepository.findAuthByEmail(email);

    if (!user) {
      throw new AppError('E-mail ou senha inválidos.', 401);
    }

    const senhaValida = await bcrypt.compare(input.senha, user.senhaHash);
    if (!senhaValida) {
      throw new AppError('E-mail ou senha inválidos.', 401);
    }

    if (!user.ativo) {
      throw new AppError('Usuário desativado. Contate o administrador.', 401);
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
    );

    return {
      token,
      user: toPublicUser(user),
    };
  },

  async getMe(userId: number): Promise<{ user: PublicUserDTO }> {
    const user = await usersRepository.findPublicById(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    return { user: toPublicUser(user) };
  },
};
