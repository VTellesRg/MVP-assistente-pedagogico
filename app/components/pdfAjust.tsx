import { NextResponse } from 'next/server';

type RagChain = {
	invoke: (input: { input: string }) => Promise<{ answer?: string }>;
};

declare global {
	// eslint-disable-next-line no-var
	var __ragChain__: RagChain | null | undefined;
}

let chain: RagChain | null = globalThis.__ragChain__ ?? null;

async function initializeRAG(): Promise<void> {
	if (chain) return;

	try {
		const openAiModuleName = '@langchain/openai';
		const memoryStoreModuleName = 'langchain/vectorstores/memory';
		const pdfLoaderModuleName = '@langchain/community/document_loaders/fs/pdf';
		const combineDocsModuleName = 'langchain/chains/combine_documents';
		const retrievalModuleName = 'langchain/chains/retrieval';
		const hubModuleName = 'langchain/hub';

		const { OpenAIEmbeddings, ChatOpenAI } = await import(openAiModuleName);
		const { MemoryVectorStore } = await import(memoryStoreModuleName);
		const { PDFLoader } = await import(pdfLoaderModuleName);
		const { createStuffDocumentsChain } = await import(combineDocsModuleName);
		const { createRetrievalChain } = await import(retrievalModuleName);
		const { PullPrompt } = await import(hubModuleName);

		const loader = new PDFLoader('./documentos/base_conhecimento.pdf');
		const docs = await loader.load();

		const embeddings = new OpenAIEmbeddings();
		const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
		const retriever = vectorStore.asRetriever(3);

		const questionAnsweringPrompt = await PullPrompt('rlm/rag-prompt');
		const llm = new ChatOpenAI({ modelName: 'gpt-3.5-turbo', temperature: 0 });

		const combineDocsChain = await createStuffDocumentsChain({
			llm: llm as unknown,
			prompt: questionAnsweringPrompt as unknown,
		});

		chain = (await createRetrievalChain({
			retriever,
			combineDocsChain,
		})) as RagChain;

		globalThis.__ragChain__ = chain;
	} catch (error: unknown) {
		console.error('Erro ao inicializar RAG:', error);
		throw error;
	}
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as { pergunta?: string };
		const pergunta = body?.pergunta?.trim();

		if (!pergunta) {
			return NextResponse.json({ erro: 'A pergunta é obrigatória.' }, { status: 400 });
		}

		if (!chain) {
			await initializeRAG();
		}

		if (!chain) {
			return NextResponse.json({ erro: 'O sistema RAG ainda está sendo carregado.' }, { status: 503 });
		}

		const response = await chain.invoke({ input: pergunta });
		return NextResponse.json({ resposta: response.answer ?? '' });
	} catch (error: unknown) {
		const detalhes = error instanceof Error ? error.message : 'Erro desconhecido';
		return NextResponse.json({ erro: 'Erro ao processar a pergunta', detalhes }, { status: 500 });
	}
}