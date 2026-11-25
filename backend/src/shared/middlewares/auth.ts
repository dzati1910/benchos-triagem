import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../errors/AppError';

/**
 * Autentica a requisição via Bearer JWT e valida se o usuário continua ativo no banco.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticação ausente ou malformado.', 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('Token de autenticação ausente ou malformado.', 401);
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError('Token inválido ou expirado.', 401);
    }

    const userId = typeof payload === 'object' && payload !== null ? Number(payload.sub) : NaN;
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError('Token inválido.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
      },
    });

    if (!user || !user.ativo) {
      throw new AppError('Sessão inválida ou usuário inativo.', 401);
    }

    req.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Restringe o acesso da rota aos perfis informados.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Usuário não autenticado.', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Acesso restrito a administradores.', 403));
      return;
    }

    next();
  };
}
