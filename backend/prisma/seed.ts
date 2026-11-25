import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedItem {
  ordem: number;
  descricao: string;
  comoTestar: string;
}

interface SeedCategoria {
  nome: string;
  icone: string;
  instrucaoGeral: string;
  itens: SeedItem[];
}

const CATEGORIAS_SEED: SeedCategoria[] = [
  {
    nome: 'HD (Disco Rígido CFTV)',
    icone: 'HardDrive',
    instrucaoGeral:
      'Priorize leitura S.M.A.R.T. no PC de bancada antes de concluir o laudo — nunca dependa apenas de detecção rápida em DVR.',
    itens: [
      {
        ordem: 1,
        descricao: 'Inspeção física de placa/conectores SATA e selo da loja',
        comoTestar:
          'Verificar oxidação nos pinos dourados, cheiro de queimado e integridade do selo da loja.',
      },
      {
        ordem: 2,
        descricao: 'Reconhecimento e ruído mecânico na partida',
        comoTestar:
          'Ligar em dock USB-SATA ou DVR de teste e observar se o disco gira sem estalos/cliques anormais.',
      },
      {
        ordem: 3,
        descricao: 'Leitura S.M.A.R.T. no PC de bancada',
        comoTestar:
          'Abrir CrystalDiskInfo/smartctl e anotar na observação: Saúde Saudável/Alerta/Crítico, Horas Ligadas e Setores Pendentes/Realocados.',
      },
      {
        ordem: 4,
        descricao: 'Teste prático de formatação e gravação',
        comoTestar:
          'Formatar e gravar trecho de vídeo ou executar teste de leitura/escrita por pelo menos 10 min sem travamento.',
      },
    ],
  },
  {
    nome: 'Câmera Hikvision / HiLook',
    icone: 'Camera',
    instrucaoGeral:
      'Sempre teste alimentação com fonte 12V conhecida ou switch PoE da bancada para descartar falha de cabo ou fonte do cliente.',
    itens: [
      {
        ordem: 1,
        descricao: 'Inspeção física, lacre/selo e cabo/conectores',
        comoTestar:
          'Conferir integridade do cabo P4/BNC/RJ45, ausência de infiltração/umidade na lente e selo da loja.',
      },
      {
        ordem: 2,
        descricao: 'Alimentação elétrica 12V / PoE e infravermelho',
        comoTestar:
          'Alimentar com fonte estabilizada 12V 1A/2A ou switch PoE de bancada; cobrir sensor frontal e verificar se LEDs IR acendem.',
      },
      {
        ordem: 3,
        descricao: 'Vídeo e foco em bancada',
        comoTestar:
          'Conectar no DVR/monitor ou localizar via SADP/navegador se IP; checar imagem limpa sem listras ou tela preta.',
      },
      {
        ordem: 4,
        descricao: 'Corte dia/noite (ICR) e Reset físico',
        comoTestar:
          'Alternar claro/escuro ouvindo estalo do filtro IR; testar botão de reset físico quando aplicável.',
      },
    ],
  },
  {
    nome: 'Gravador DVR / NVR Hikvision / HiLook',
    icone: 'Server',
    instrucaoGeral:
      'Teste inicialmente sem HD e com fonte 12V da bancada para isolar defeito do gravador em relação a disco ou fonte do cliente.',
    itens: [
      {
        ordem: 1,
        descricao: 'Inspeção física e fonte de alimentação',
        comoTestar:
          'Checar conectores traseiros/oxidação, selo da loja e testar preferencialmente com fonte 12V conhecida de bancada.',
      },
      {
        ordem: 2,
        descricao: 'Inicialização e saída de vídeo',
        comoTestar:
          'Ligar com monitor HDMI/VGA conectado e confirmar bip único de boot e tela inicial sem reinicializações.',
      },
      {
        ordem: 3,
        descricao: 'Porta SATA e reconhecimento de HD de bancada',
        comoTestar:
          'Plugar HD de teste, verificar se reconhece capacidade corretamente e inicia gravação.',
      },
      {
        ordem: 4,
        descricao: 'Canais de vídeo e portas de rede/PoE',
        comoTestar:
          'Conectar câmera de teste nos canais BNC ou portas PoE do NVR e testar link Ethernet/Hik-Connect.',
      },
      {
        ordem: 5,
        descricao: 'Ventoinha e aquecimento',
        comoTestar:
          'Verificar giro silencioso do cooler e temperatura estável após 10 minutos ligado.',
      },
    ],
  },
  {
    nome: 'Controle de Acesso AGL',
    icone: 'KeyRound',
    instrucaoGeral:
      'Utilize fonte 12V protegida na bancada e inspecione os bornes antes de energizar para identificar eventual inversão de polaridade.',
    itens: [
      {
        ordem: 1,
        descricao: 'Inspeção física, bornes e selo da loja',
        comoTestar:
          'Checar oxidação nos bornes de ligação, trilhas queimadas por ligação errada e integridade do selo.',
      },
      {
        ordem: 2,
        descricao: 'Alimentação 12V controlada na bancada',
        comoTestar:
          'Alimentar com fonte 12V protegida/multímetro, observando consumo e LEDs indicadores sem aquecimento anormal.',
      },
      {
        ordem: 3,
        descricao: 'Leitura de credencial (TAG RFID / biometria / senha)',
        comoTestar:
          'Aproximar TAG ou digitar senha padrão de teste e confirmar reconhecimento sonoro/visual.',
      },
      {
        ordem: 4,
        descricao: 'Acionamento de saída de relé / fechadura e botoeira',
        comoTestar:
          'Testar contato NA/NF/COM com fechadura de bancada ou multímetro em continuidade ao acionar abertura e botoeira.',
      },
      {
        ordem: 5,
        descricao: 'Reset de fábrica / programação padrão',
        comoTestar:
          'Validar procedimento de reset de fábrica conforme modelo AGL.',
      },
    ],
  },
];

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nome = process.env.SEED_ADMIN_NAME?.trim() || 'Administrador BenchOS';

  if (!email || !password) {
    throw new Error(
      'Variáveis SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórias para o seed.',
    );
  }

  const senhaHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      nome,
      senhaHash,
      role: 'ADMIN',
      ativo: true,
    },
    create: {
      nome,
      email,
      senhaHash,
      role: 'ADMIN',
      ativo: true,
    },
  });
}

async function seedCategorias(): Promise<void> {
  for (const catData of CATEGORIAS_SEED) {
    const categoria = await prisma.categoria.upsert({
      where: { nome: catData.nome },
      update: {
        icone: catData.icone,
        instrucaoGeral: catData.instrucaoGeral,
        ativo: true,
      },
      create: {
        nome: catData.nome,
        icone: catData.icone,
        instrucaoGeral: catData.instrucaoGeral,
        ativo: true,
      },
    });

    for (const item of catData.itens) {
      const existing = await prisma.itemChecklist.findFirst({
        where: {
          categoriaId: categoria.id,
          ordem: item.ordem,
        },
      });

      if (existing) {
        await prisma.itemChecklist.update({
          where: { id: existing.id },
          data: {
            descricao: item.descricao,
            comoTestar: item.comoTestar,
            ativo: true,
          },
        });
      } else {
        await prisma.itemChecklist.create({
          data: {
            categoriaId: categoria.id,
            ordem: item.ordem,
            descricao: item.descricao,
            comoTestar: item.comoTestar,
            ativo: true,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedCategorias();
  console.log('Seed BenchOS concluído com sucesso.');
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
