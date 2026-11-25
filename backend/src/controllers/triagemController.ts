import { Request, Response } from 'express';
import db from '../database/db';
import { ConcluirTriagemInput } from '../types';

// Listar todas as triagens com dados do cliente e categoria
export function listarTriagens(req: Request, res: Response) {
  try {
    const { status, busca } = req.query;

    let sql = `
      SELECT 
        t.*,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        cat.nome as categoria_nome,
        cat.icone as categoria_icone
      FROM triagens t
      JOIN clientes c ON t.cliente_id = c.id
      JOIN categorias cat ON t.categoria_id = cat.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (busca) {
      sql += ` AND (t.numero_serie_mac LIKE ? OR t.modelo LIKE ? OR c.nome LIKE ?)`;
      const term = `%${busca}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY t.id DESC`;

    const stmt = db.prepare(sql);
    const triagens = stmt.all(...params);

    return res.json(triagens);
  } catch (error) {
    console.error('Erro ao listar triagens:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar triagens' });
  }
}

// Obter detalhes de uma triagem específica + checklist e respostas
export function obterTriagem(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const triagemStmt = db.prepare(`
      SELECT 
        t.*,
        c.nome as cliente_nome,
        c.telefone as cliente_telefone,
        c.documento as cliente_documento,
        cat.nome as categoria_nome
      FROM triagens t
      JOIN clientes c ON t.cliente_id = c.id
      JOIN categorias cat ON t.categoria_id = cat.id
      WHERE t.id = ?
    `);

    const triagem = triagemStmt.get(id);

    if (!triagem) {
      return res.status(404).json({ error: 'Triagem não encontrada' });
    }

    // Itens de checklist padrão da categoria do produto
    const itensStmt = db.prepare(`
      SELECT * FROM itens_checklist 
      WHERE categoria_id = ? 
      ORDER BY ordem ASC
    `);
    const itens = itensStmt.all((triagem as any).categoria_id);

    // Respostas já gravadas (se houver)
    const respostasStmt = db.prepare(`
      SELECT * FROM triagem_respostas 
      WHERE triagem_id = ?
    `);
    const respostas = respostasStmt.all(id);

    return res.json({
      triagem,
      itensChecklist: itens,
      respostas
    });
  } catch (error) {
    console.error('Erro ao obter triagem:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar detalhes da triagem' });
  }
}

// Criar nova entrada de triagem
export function criarTriagem(req: Request, res: Response) {
  try {
    const {
      cliente_id,
      categoria_id,
      modelo,
      fabricante,
      numero_serie_mac,
      defeito_reclamado,
      acessorios_inclusos,
      tecnico_responsavel
    } = req.body;

    // Validação básica dos campos obrigatórios
    if (!cliente_id || !categoria_id || !modelo || !numero_serie_mac || !defeito_reclamado) {
      return res.status(400).json({
        error: 'Preencha todos os campos obrigatórios: cliente, categoria, modelo, número de série e defeito.'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO triagens (
        cliente_id, categoria_id, modelo, fabricante,
        numero_serie_mac, defeito_reclamado, acessorios_inclusos,
        tecnico_responsavel, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
    `);

    const result = stmt.run(
      cliente_id,
      categoria_id,
      modelo,
      fabricante || 'Não informado',
      numero_serie_mac.toUpperCase().trim(),
      defeito_reclamado,
      acessorios_inclusos || 'Nenhum',
      tecnico_responsavel || 'Aguardando atribuição'
    );

    return res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Equipamento registrado para triagem com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao criar triagem:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar triagem' });
  }
}

// Concluir o teste de bancada e salvar o checklist e parecer final
export function concluirTriagem(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { diagnostico_final, parecer_tecnico, tecnico_responsavel, respostas }: ConcluirTriagemInput = req.body;

    if (!diagnostico_final || !parecer_tecnico || !tecnico_responsavel) {
      return res.status(400).json({
        error: 'Preencha o diagnóstico final, parecer técnico e nome do técnico responsável.'
      });
    }

    const updateTriagem = db.prepare(`
      UPDATE triagens 
      SET 
        status = 'CONCLUIDO',
        diagnostico_final = ?,
        parecer_tecnico = ?,
        tecnico_responsavel = ?,
        concluido_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertResposta = db.prepare(`
      INSERT INTO triagem_respostas (triagem_id, item_checklist_id, passou, observacao)
      VALUES (?, ?, ?, ?)
    `);

    // Usamos transação atômica para garantir que todas as respostas e o update fiquem íntegros
    const transaction = db.transaction(() => {
      updateTriagem.run(diagnostico_final, parecer_tecnico, tecnico_responsavel, id);

      // Limpa respostas anteriores caso seja reavaliação
      db.prepare('DELETE FROM triagem_respostas WHERE triagem_id = ?').run(id);

      if (respostas && respostas.length > 0) {
        for (const r of respostas) {
          insertResposta.run(id, r.item_checklist_id, r.passou ? 1 : 0, r.observacao || '');
        }
      }
    });

    transaction();

    return res.json({ message: 'Triagem e checklist de bancada concluídos com sucesso!' });
  } catch (error) {
    console.error('Erro ao concluir triagem:', error);
    return res.status(500).json({ error: 'Erro ao salvar conclusão da triagem' });
  }
}
