import { Request, Response } from 'express';
import db from '../database/db';

export function listarClientes(req: Request, res: Response) {
  try {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome ASC').all();
    return res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
}

export function criarCliente(req: Request, res: Response) {
  try {
    const { nome, telefone, documento } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'O nome do cliente ou instalador é obrigatório.' });
    }

    const stmt = db.prepare('INSERT INTO clientes (nome, telefone, documento) VALUES (?, ?, ?)');
    const result = stmt.run(nome.trim(), telefone || '', documento || '');

    return res.status(201).json({
      id: result.lastInsertRowid,
      nome,
      telefone,
      documento
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente' });
  }
}
