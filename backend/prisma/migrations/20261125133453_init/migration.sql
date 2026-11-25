-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "StatusSelo" AS ENUM ('INTEGRO', 'VIOLADO', 'SEM_SELO');

-- CreateEnum
CREATE TYPE "StatusTriagem" AS ENUM ('PENDENTE', 'EM_ANALISE', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DiagnosticoFinal" AS ENUM ('OPERACIONAL', 'DEFEITO_FABRICA', 'ENCAMINHAR_ESPECIALISTA', 'SEM_GARANTIA');

-- CreateEnum
CREATE TYPE "ResultadoItemChecklist" AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO', 'NAO_TESTADO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FUNCIONARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "documento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "icone" TEXT NOT NULL,
    "instrucaoGeral" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemChecklist" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "comoTestar" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Triagem" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "recebidoPorId" INTEGER NOT NULL,
    "analiseIniciadaPorId" INTEGER,
    "concluidoPorId" INTEGER,
    "canceladoPorId" INTEGER,
    "ultimaAtualizacaoPorId" INTEGER,
    "modelo" TEXT NOT NULL,
    "fabricante" TEXT NOT NULL,
    "numeroSerieMac" TEXT NOT NULL,
    "statusSelo" "StatusSelo" NOT NULL,
    "observacaoSelo" TEXT,
    "defeitoReclamado" TEXT NOT NULL,
    "acessoriosInclusos" TEXT,
    "status" "StatusTriagem" NOT NULL DEFAULT 'PENDENTE',
    "diagnosticoFinal" "DiagnosticoFinal",
    "parecerTecnico" TEXT,
    "resumoCliente" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analiseIniciadaEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Triagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriagemResposta" (
    "id" SERIAL NOT NULL,
    "triagemId" INTEGER NOT NULL,
    "itemChecklistId" INTEGER NOT NULL,
    "resultado" "ResultadoItemChecklist" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "respondidoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriagemResposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE INDEX "ItemChecklist_categoriaId_ordem_idx" ON "ItemChecklist"("categoriaId", "ordem");

-- CreateIndex
CREATE INDEX "Triagem_numeroSerieMac_idx" ON "Triagem"("numeroSerieMac");

-- CreateIndex
CREATE UNIQUE INDEX "TriagemResposta_triagemId_itemChecklistId_key" ON "TriagemResposta"("triagemId", "itemChecklistId");

-- AddForeignKey
ALTER TABLE "ItemChecklist" ADD CONSTRAINT "ItemChecklist_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_analiseIniciadaPorId_fkey" FOREIGN KEY ("analiseIniciadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_concluidoPorId_fkey" FOREIGN KEY ("concluidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Triagem" ADD CONSTRAINT "Triagem_ultimaAtualizacaoPorId_fkey" FOREIGN KEY ("ultimaAtualizacaoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriagemResposta" ADD CONSTRAINT "TriagemResposta_triagemId_fkey" FOREIGN KEY ("triagemId") REFERENCES "Triagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriagemResposta" ADD CONSTRAINT "TriagemResposta_itemChecklistId_fkey" FOREIGN KEY ("itemChecklistId") REFERENCES "ItemChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriagemResposta" ADD CONSTRAINT "TriagemResposta_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
