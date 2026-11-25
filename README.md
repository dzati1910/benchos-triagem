# BenchOS - Sistema de Triagem Técnica & Bancada de Testes

Sistema web fullstack 100% digital desenvolvido para distribuidoras de segurança eletrônica e redes (câmeras, switches PoE, DVRs/NVRs e no-breaks).

O objetivo do sistema é padronizar a triagem de equipamentos devolvidos por instaladores e clientes, separando com rigor técnico o que é **falha de configuração/instalação do cliente** do que é **defeito de fabricação real (garantia/RMA)** ou **mau uso (descarga elétrica/inversão de polaridade)**.

---

## 🏗️ Arquitetura do Projeto

```text
sistema-triagem/
├── backend/                  # API REST em Node.js com TypeScript e Express
│   ├── src/
│   │   ├── database/db.ts   # Conexão SQLite (better-sqlite3) e migrations/seeds
│   │   ├── controllers/     # Lógica de negócio (triagens, categorias, clientes)
│   │   ├── types/           # Interfaces TypeScript e DTOs
│   │   └── server.ts        # Ponto de entrada Express na porta 3001
│   └── tsconfig.json
│
├── frontend/                 # SPA em React com Vite, TypeScript e Tailwind CSS
│   ├── src/
│   │   ├── components/      # Badges de status, Modal de Entrada, Checklist dinâmico
│   │   ├── services/api.ts  # Cliente de chamadas REST (fetch tipado)
│   │   ├── types.ts         # Modelos de dados compartilhados
│   │   ├── App.tsx          # Dashboard, Kanban de métricas e filtros rápidos
│   │   └── main.tsx
│   └── vite.config.ts
│
├── iniciar.sh                # Script único para rodar Backend + Frontend na rede local
└── README.md
```

---

## 💡 Como os Conceitos se Conectam com o Mercado de TI (ADS)

| Conceito do Projeto | Como funciona no código | O que dizer em uma entrevista técnica |
| :--- | :--- | :--- |
| **Arquitetura Desacoplada (Client-Server)** | Frontend (React :3000) consome Backend (Express :3001) via HTTP JSON | *"Separei a interface da regra de negócio para permitir escalabilidade e fácil consumo por múltiplos clientes na rede local."* |
| **RESTful API & HTTP Verbs** | Rotas estruturadas com `GET`, `POST` e `PATCH` | *"Segui a semântica REST: GET para leituras sem efeitos colaterais, POST para criar entidades e PATCH para atualizar o parecer técnico e respostas do checklist."* |
| **Transações ACID** | `db.transaction()` no SQLite ao concluir laudos e ao semear dados | *"Utilizei transações atômicas para garantir que o parecer e os múltiplos itens do checklist sejam gravados em bloco ou sofram rollback caso ocorra falha."* |
| **TypeScript End-to-End** | Interfaces e Types compartilhando os mesmos contratos | *"Adotei TypeScript para garantir segurança de tipos em tempo de compilação, eliminando erros comuns de runtime e facilitando refatorações."* |
| **Reatividade no React** | Hooks (`useState`, `useEffect`) e derivação de estado | *"O cálculo de diagnóstico (Operacional vs Defeito) é reativo: se um único teste de hardware falhar no checklist, o estado é recalculado instantaneamente."* |

---

## 🚀 Como Iniciar o Sistema na Loja

### 1. Iniciar em Modo de Desenvolvimento / Produção Local:
Basta executar o script raiz:
```bash
cd /home/dzati/sistema-triagem
./iniciar.sh
```

### 2. Acesso:
- **No próprio computador:** Abra o navegador em `http://localhost:3000`
- **De qualquer outro PC da loja (balcão ou bancada):** Abra `http://[IP_DO_SERVIDOR]:3000` (ex: `http://192.168.1.100:3000`)

---

## 🛠️ Procedimento de Segurança na Bancada de Testes
Para evitar que equipamentos de clientes causem conflitos de rede no servidor principal:
1. Conecte o PC da bancada a um switch isolado dedicado aos testes.
2. Evite plugar câmeras IP em modo DHCP ou com IP default (`192.168.1.108`) na rede do ERP da loja.
3. Tenha sempre em mãos um multímetro para aferir tensão de baterias de no-breaks (> 12.5V) e fontes 12V sob carga.
