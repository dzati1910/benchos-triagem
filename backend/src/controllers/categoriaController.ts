import { Request, Response } from 'express';
import db from '../database/db';

export function listarCategorias(req: Request, res: Response) {
  try {
    const categorias = db.prepare('SELECT * FROM categorias ORDER BY nome ASC').all();
    const itens = db.prepare('SELECT * FROM itens_checklist ORDER BY ordem ASC').all();

    // Agrupa os itens de checklist dentro de cada categoria
    const resultado = categorias.map((cat: any) => ({
      ...cat,
      checklists: itens.filter((item: any) => item.categoria_id === cat.id)
    }));

    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar categorias' });
  }
}
