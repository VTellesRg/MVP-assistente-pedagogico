import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, ResponseSchema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type InputChunk = {
	id?: string;
	text: string;
	source?: string;
	metadata?: Record<string, unknown>;
};

type RagRequestBody = {
	question: string;
	chunks?: InputChunk[];
	topK?: number;
	pdfBase64?: string;
	pdfName?: string;
};

type PdfInput = {
	base64: string;
	name?: string;
};

const ragOutputSchema: ResponseSchema = {
	type: SchemaType.OBJECT,
	properties: {
		answer: {
			type: SchemaType.STRING,
			description: 'Resposta final para o usuário em português.'
		},
		sources: {
			type: SchemaType.ARRAY,
			description: 'Lista de fontes usadas para responder.',
			items: {
				type: SchemaType.OBJECT,
				properties: {
					id: { type: SchemaType.STRING },
					source: { type: SchemaType.STRING },
					excerpt: { type: SchemaType.STRING }
				},
				required: ['excerpt']
			}
		}
	},
	required: ['answer', 'sources']
};

function tokenize(value: string): string[] {
	return value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.split(/\s+/)
		.filter(Boolean);
}

function scoreChunk(question: string, chunkText: string): number {
	const qTokens = new Set(tokenize(question));
	if (!qTokens.size) return 0;

	const cTokens = tokenize(chunkText);
	let overlap = 0;
	for (const token of cTokens) {
		if (qTokens.has(token)) overlap += 1;
	}

	return overlap / Math.max(cTokens.length, 1);
}

function retrieveTopKChunks(question: string, chunks: InputChunk[], topK: number): InputChunk[] {
	return chunks
		.map((chunk) => ({ chunk, score: scoreChunk(question, chunk.text) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, Math.max(1, topK))
		.map(({ chunk }) => chunk);
}

function buildPrompt(question: string, retrievedChunks: InputChunk[]): string {
	const contextBlock = retrievedChunks
		.map((chunk, idx) => {
			const chunkId = chunk.id ?? `chunk-${idx + 1}`;
			const chunkSource = chunk.source ?? 'sem-fonte';
			return `[${chunkId}] (${chunkSource}) ${chunk.text}`;
		})
		.join('\n\n');

	return [
		'Você é um assistente de RAG.',
		'Responda somente com base no contexto recuperado.',
		'Quando houver PDF anexado, use também esse conteúdo como contexto.',
		'Se o contexto não for suficiente, diga explicitamente que não há dados suficientes.',
		'',
		`Pergunta: ${question}`,
		'',
		'Contexto recuperado:',
		contextBlock || 'Nenhum contexto disponível.'
	].join('\n');
}

async function generateRagAnswer(question: string, retrievedChunks: InputChunk[], pdf?: PdfInput) {
	const model = genAI.getGenerativeModel({
		model: "gemini-2.5-flash",
		generationConfig: {
			responseMimeType: 'application/json',
			responseSchema: ragOutputSchema
		}
	});

	const prompt = buildPrompt(question, retrievedChunks);
	const result = await model.generateContent(
		pdf
			? [
				prompt,
				{
					inlineData: {
						mimeType: 'application/pdf',
						data: pdf.base64
					}
				}
			]
			: prompt
	);
	const text = result.response.text();

	let parsed: { answer?: string; sources?: Array<{ id?: string; source?: string; excerpt?: string }> } = {};
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = { answer: text, sources: [] };
	}

	const fallbackSources = retrievedChunks.map((chunk, idx) => ({
		id: chunk.id ?? `chunk-${idx + 1}`,
		source: chunk.source ?? 'sem-fonte',
		excerpt: chunk.text.slice(0, 300)
	}));

	if (pdf) {
		fallbackSources.push({
			id: 'pdf-1',
			source: pdf.name ?? 'documento.pdf',
			excerpt: 'Conteúdo extraído do PDF anexado.'
		});
	}

	return {
		answer: parsed.answer ?? 'Não foi possível gerar resposta.',
		sources: parsed.sources?.length ? parsed.sources : fallbackSources
	};
}



export async function POST(request: NextRequest) {
	try {
		if (!process.env.GEMINI_API_KEY) {
			return NextResponse.json(
				{ error: 'GEMINI_API_KEY is not configured' },
				{ status: 500 }
			);
		}

		const body = (await request.json()) as RagRequestBody;
		const { question, chunks = [], topK = 4, pdfBase64, pdfName } = body;

		if (!question) {
			return NextResponse.json(
				{ error: 'Question is required' },
				{ status: 400 }
			);
		}

		if (!Array.isArray(chunks) || chunks.some((chunk) => !chunk?.text)) {
			return NextResponse.json(
				{ error: 'chunks must be an array of objects with a text field' },
				{ status: 400 }
			);
		}

		let pdfInput: PdfInput | undefined;
		if (typeof pdfBase64 === 'string' && pdfBase64.trim()) {
			const normalized = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
			if (!normalized) {
				return NextResponse.json(
					{ error: 'pdfBase64 is invalid' },
					{ status: 400 }
				);
			}

			pdfInput = { base64: normalized, name: pdfName };
		}

		// RAG Orchestrator
		const retrievedChunks = retrieveTopKChunks(question, chunks, topK);
		const llmResult = await generateRagAnswer(question, retrievedChunks, pdfInput);

		const response = {
			question,
			answer: llmResult.answer,
			sources: llmResult.sources,
			retrievedCount: retrievedChunks.length,
			timestamp: new Date().toISOString(),
		};

		console.log('RAG Response:', response);

		return NextResponse.json(response, { status: 200 });
	} catch (error) {
		console.error('Error processing request:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function GET() {
	return NextResponse.json(
		{ message: 'Use POST method to ask questions' },
		{ status: 405 }
	);
}