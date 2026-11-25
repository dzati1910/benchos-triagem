import express from 'express';
import cors from 'cors';
import { initDatabase } from './database/db';
import {
  listarTriagens,
  obterTriagem,
  criarTriagem,
  concluirTriagem
} from './controllers/triagemController';
import { listarCategorias } from './controllers/categoriaController';
import { listarClientes, criarCliente } from './controllers/clienteController';

// Inicializa o banco de dados SQLite e tabelas
initDatabase();

const app = express();
const PORT = 3001;

// Middlewares essenciais para APIs REST modernas
app.use(cors()); // Permite que o frontend acerte chamadas na API sem bloqueio de segurança CORS
app.use(express.json()); // Converte payloads JSON enviados no corpo da requisição em objetos JavaScript

// Rotas de Clientes
app.get('/api/clientes', listarClientes);
app.post('/api/clientes', criarCliente);

// Rotas de Categorias e Checklists
app.get('/api/categorias', listarCategorias);

// Rotas de Triagem e Testes de Bancada
app.get('/api/triagens', listarTriagens);
app.get('/api/triagens/:id', obterTriagem);
app.post('/api/triagens', criarTriagem);
app.patch('/api/triagens/:id/concluir', concluirTriagem);

// Rota de Healthcheck (Verificação de Status)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API de Triagem Técnica operando perfeitamente!' });
});

// Inicia o servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
});
