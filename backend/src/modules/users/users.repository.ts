import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface PublicUserDTO {
  id: number;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criadoEm: Date;
}

export interface AuthUserRecord extends PublicUserDTO {
  senhaHash: string;
}

export const publicUserSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  criadoEm: true,
} satisfies Prisma.UserSelect;

/**
 * Repositório de acesso aos dados de usuários via Prisma.
 */
export const usersRepository = {
  findAllPublic(): Promise<PublicUserDTO[]> {
    return prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { id: 'asc' },
    });
  },

  findPublicById(id: number): Promise<PublicUserDTO | null> {
    return prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  },

  findAuthByEmail(email: string): Promise<AuthUserRecord | null> {
    return prisma.user.findUnique({
      where: { email },
      select: {
        ...publicUserSelect,
        senhaHash: true,
      },
    });
  },

  create(data: {
    nome: string;
    email: string;
    senhaHash: string;
    role: Role;
  }): Promise<PublicUserDTO> {
    return prisma.user.create({
      data,
      select: publicUserSelect,
    });
  },

  updatePublic(
    id: number,
    data: { nome?: string; role?: Role; ativo?: boolean },
  ): Promise<PublicUserDTO> {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  },

  async updatePasswordHash(id: number, senhaHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { senhaHash },
      select: { id: true },
    });
  },
};
