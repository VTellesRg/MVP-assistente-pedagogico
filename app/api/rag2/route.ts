/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import pdfParser from "pdf-parse";

/* async function obterModelosDisponiveis() {
	const apiKey = process.env.GOOGLE_API_KEY;

	if (!apiKey) {
		throw new Error("GOOGLE_API_KEY não configurada.");
	}

	const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

	if (!response.ok) {
		throw new Error(`Falha ao obter modelos: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	return (data.models ?? []).map((model: { name?: string }) => model.name).filter(Boolean);
} */

export async function POST(req: Request) {
	try {


		/* 	obterModelosDisponiveis().then((modelos) => {
				console.log("Modelos disponíveis:", modelos);
			}).catch((error) => {
				console.error("Erro ao obter modelos:", error);
			}); */


		// 1. Receber os dados do FormData enviado pelo Frontend
		const formData = await req.formData();

		const file = formData.get("file");
		const pergunta = formData.get("pergunta");

		if (!file || !pergunta) {
			return NextResponse.json({ error: "Arquivo e pergunta são obrigatórios." }, { status: 400 });
		}

		if (!(file instanceof Blob) || typeof pergunta !== "string") {
			return NextResponse.json({ error: "Tipo de arquivo ou pergunta inválido." }, { status: 400 });
		}

		// 2. Converter o arquivo recebido para Buffer e extrair o texto brudo do PDF
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);
		const parsedPdf = await pdfParser(buffer);
		const textoCompletoDoPdf = parsedPdf.text;

		// Criar o formato de Documento abstrato exigido pelo LangChain
		const rawDocument = new Document({ pageContent: textoCompletoDoPdf });

		// 3. Criar os Chunks (Fatiamento Semântico Inteligente)
		// O RecursiveCharacterTextSplitter divide preservando parágrafos e frases juntos
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 800,       // Tamanho máximo de caracteres por fatia
			chunkOverlap: 100,    // Quantidade de caracteres que se repetem na próxima fatia para manter contexto
		});
		const chunks = await splitter.splitDocuments([rawDocument]);

		// 4. Configurar os Embeddings da OpenAI e criar o Vector Store Temporário
		const embeddings = new GoogleGenerativeAIEmbeddings({
			model: "gemini-embedding-2-preview"
		});

		// Salva os chunks vetorizados na memória volátil desta execução de requisição
		const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);
		const retriever = vectorStore.asRetriever({ k: 4 }); // Resgata as 4 fatias mais relevantes para a pergunta

		// 5. Configurar o Modelo da OpenAI e o Prompt Customizado
		const llm = new ChatGoogleGenerativeAI({
			model: "gemini-3.5-flash",
			temperature: 0.1,
		});

		const prompt = ChatPromptTemplate.fromTemplate(`
			Você é um assistente virtual especialista. Use o contexto fornecido para gerar conhecimento."

			Contexto:
			{context}

			Pergunta:
			{input}

			Resposta:
		`);

		// 6. Criar e Executar a Esteira de RAG (Retrieval Chain)
		const combineDocsChain = await createStuffDocumentsChain({
			llm: llm as unknown as any,
			prompt: prompt as unknown as any,
		});

		const retrievalChain = await createRetrievalChain({
			retriever,
			combineDocsChain,
		});

		// Executa a busca vetorial cruzada com a IA
		const response = await retrievalChain.invoke({ input: pergunta });

		return NextResponse.json({ answer: `${response.answer}` });

	} catch (error) {
		console.error("Erro na pipeline de RAG:", error);
		return NextResponse.json({ error: "Erro interno ao processar o RAG com Gemini." }, { status: 500 });
	}
}