import Database from 'better-sqlite3';
import path from 'path';

// O banco fica salvo em um arquivo local 'triagem.db' dentro da pasta database
const dbPath = path.resolve(__dirname, '../../triagem.db');
const db = new Database(dbPath);

// Ativa suporte a chaves estrangeiras (Foreign Keys) no SQLite
db.pragma('foreign_keys = ON');

// Criação das tabelas
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      documento TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      icone TEXT
    );

    CREATE TABLE IF NOT EXISTS itens_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL,
      descricao TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS triagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL,
      modelo TEXT NOT NULL,
      fabricante TEXT NOT NULL,
      numero_serie_mac TEXT NOT NULL,
      defeito_reclamado TEXT NOT NULL,
      acessorios_inclusos TEXT,
      tecnico_responsavel TEXT,
      status TEXT DEFAULT 'PENDENTE', -- PENDENTE, EM_ANALISE, CONCLUIDO
      diagnostico_final TEXT,         -- OPERACIONAL, DEFEITO_FABRICA, MAU_USO
      parecer_tecnico TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      concluido_em DATETIME,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

    CREATE TABLE IF NOT EXISTS triagem_respostas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      triagem_id INTEGER NOT NULL,
      item_checklist_id INTEGER NOT NULL,
      passou INTEGER NOT NULL, -- 1 = Sim / Passou no teste, 0 = Falhou
      observacao TEXT,
      FOREIGN KEY (triagem_id) REFERENCES triagens(id) ON DELETE CASCADE,
      FOREIGN KEY (item_checklist_id) REFERENCES itens_checklist(id)
    );
  `);

  seedInitialData();
}

// Popula dados padrão se o banco estiver vazio
function seedInitialData() {
  const count = db.prepare('SELECT COUNT(*) as total FROM categorias').get() as { total: number };
  if (count.total > 0) return;

  const insertCategoria = db.prepare('INSERT INTO categorias (nome, icone) VALUES (?, ?)');
  const insertChecklist = db.prepare('INSERT INTO itens_checklist (categoria_id, descricao, ordem) VALUES (?, ?, ?)');

  const categorias = [
    {
      nome: 'Câmera IP / Analógica',
      icone: 'Camera',
      checklists: [
        'Inspeção física visual (sem lacre rompido, sem água interna, sem marcas de queima/cheiro)',
        'Alimentação elétrica 12V / PoE (acende LEDs infravermelhos ao cobrir sensor óptico)',
        'Comunicação de Rede / Resposta ao Ping (localizada via IP Utility / SADP ou IP padrão)',
        'Qualidade de Imagem (vídeo limpo, foco adequado, sem ruído na imagem)',
        'Teste do Filtro ICR (troca dia/noite estalando o filtro infravermelho no escuro)',
        'Reset de Fábrica (botão físico restaura IP e credenciais para padrão de fábrica)'
      ]
    },
    {
      nome: 'Switch PoE / Rede',
      icone: 'Network',
      checklists: [
        'Inspeção física (pinos RJ45 alinhados e sem oxidação ou descarga elétrica visível)',
        'Alimentação AC / Fonte interna (LED Power acende e permanece estável)',
        'Fornecimento de Energia PoE (alimentou câmera de teste em todas as portas PoE)',
        'Tráfego e Portas Uplink (negociou velocidade Gigabit / 1000 Mbps e link estável)',
        'Isolamento de portas / VLAN física (se aplicável ao modelo do switch)'
      ]
    },
    {
      nome: 'Gravador DVR / NVR',
      icone: 'HardDrive',
      checklists: [
        'Boot e Inicialização (bip único de boot e imagem HDMI/VGA no monitor de teste)',
        'Reconhecimento de Disco Rígido SATA (reconheceu HD de teste e permitiu gravação)',
        'Reconhecimento de Canais de Vídeo (detectou sinal de vídeo nas portas de teste)',
        'Conexão de Rede e Nuvem (P2P / Cloud mostra status "Conectado")',
        'Ventoinha / Temperatura (cooler interno gira sem ruído excessivo ou travamento)'
      ]
    },
    {
      nome: 'No-break / Fonte de Alimentação',
      icone: 'Zap',
      checklists: [
        'Fusível e Cabo AC (fusível íntegro e alimentação elétrica sem aquecimento)',
        'Tensão de Saída em Rede Elétrica (multímetro acusa 115V/220V estabilizado)',
        'Tensão da Bateria em Repouso (multímetro registra acima de 12.5V na bateria)',
        'Comportamento do Inversor (ao cortar energia AC, manteve carga de teste ligada)',
        'Alarme Sonoro e Sinalização (beeps e LEDs operando conforme manual do fabricante)'
      ]
    }
  ];

  const transaction = db.transaction(() => {
    for (const cat of categorias) {
      const result = insertCategoria.run(cat.nome, cat.icone);
      const catId = result.lastInsertRowid as number;

      cat.checklists.forEach((desc, index) => {
        insertChecklist.run(catId, desc, index + 1);
      });
    }
  });

  transaction();
  console.log('✅ Banco de dados SQLite inicializado e populado com checklists técnicos!');
}

export default db;
