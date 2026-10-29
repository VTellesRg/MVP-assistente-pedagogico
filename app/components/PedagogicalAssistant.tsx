/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";

export default function PedagogicalAssistant() {
	const [persona, setPersona] = useState("Especialista em linguagem de programação python");
	const [publico, setPublico] = useState("Estudantes do 1 semestre de matematica licenciatura");
	const [abordagem, setAbordagem] = useState("Atividade de trabalho em grupo");
	const [tarefa, setTarefa] = useState("quatro questões com dois niveis de dificuldade, relacionando  conceitos matematicos com python, com gabarito e explicação detalhada das respostas");

	const [answer, setAnswer] = useState("");
	const [context, setContext] = useState<unknown>(null);

	const [loading, setLoading] = useState(false);

	// Upload PDF
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [uploadMessage, setUploadMessage] = useState("");
	const [uploading, setUploading] = useState(false);

	const prompt = `
Persona: ${persona}
Público: ${publico}
Tipo de abordagem: ${abordagem}
Tarefa: ${tarefa}
`.trim();

	async function uploadPdf() {
		if (!pdfFile) {
			setUploadMessage("Selecione um PDF.");
			return;
		}

		try {
			setUploading(true);

			const formData = new FormData();

			formData.append("file", pdfFile);

			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(
					result.error ?? "Erro no upload"
				);
			}

			setUploadMessage(
				`✅ ${result.fileName} enviado com sucesso`
			);
		} catch (error) {
			setUploadMessage(
				error instanceof Error
					? error.message
					: "Erro no upload"
			);
		} finally {
			setUploading(false);
		}
	}

	async function execute() {
		setLoading(true);

		try {
			const formData = new FormData();
			if (!pdfFile) {
				alert("Selecione um arquivo PDF.");
				return;
			}

			formData.append("pergunta", prompt);
			formData.append("file", pdfFile);

			const response = await fetch("/api/rag2", {
				method: "POST",
				body: formData,
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(
					data.error ?? "Erro ao consultar IA"
				);
			}

			setAnswer(data.answer ?? data.resposta);
			//TODO: Ajustar o tipo de context para algo mais específico, se possível


			setContext(data.context);
		} catch (error) {
			setAnswer(
				error instanceof Error
					? error.message
					: "Erro desconhecido"
			);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		// Limpa a resposta e o contexto quando o prompt muda
		console.log("answer atualizado:", answer);
	}, [answer]);

	useEffect(() => {
		// Limpa a resposta e o contexto quando o prompt muda
		console.log("context atualizado:", context);
	}, [context]);

	return (
		<div className="max-w-7xl mx-auto text-gray-100">

			<h1 className="text-4xl font-bold mb-8 text-white">
				Sistema de Apoio Pedagógico com IA
			</h1>

			<div className="grid lg:grid-cols-2 gap-6">

				{/* Formulário */}
				<div className="bg-gray-900 border border-gray-800 rounded-xl shadow p-6 space-y-4">

					<input
						className="w-full border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 rounded p-3"
						placeholder="Persona"
						value={persona}
						onChange={(e) =>
							setPersona(e.target.value)
						}
					/>

					<input
						className="w-full border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 rounded p-3"
						placeholder="Público"
						value={publico}
						onChange={(e) =>
							setPublico(e.target.value)
						}
					/>

					<input
						className="w-full border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 rounded p-3"
						placeholder="Tipo de abordagem"
						value={abordagem}
						onChange={(e) =>
							setAbordagem(e.target.value)
						}
					/>

					<input
						className="w-full border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 rounded p-3"
						placeholder="Tarefa"
						value={tarefa}
						onChange={(e) =>
							setTarefa(e.target.value)
						}
					/>

				</div>

				{/* Painéis da direita */}
				<div className="space-y-6">

					{/* Upload PDF */}
					<div className="bg-gray-900 border border-gray-800 rounded-xl shadow p-6">

						<h2 className="font-semibold text-lg mb-4">
							Base de Conhecimento (RAG)
						</h2>

						<input
							type="file"
							accept=".pdf"
							onChange={(e) =>
								setPdfFile(
									e.target.files?.[0] ?? null
								)
							}
							className="
                w-full
                border
                border-gray-700
                bg-gray-800
                rounded
                p-3
                text-gray-100
              "
						/>

						<button
							onClick={uploadPdf}
							disabled={uploading}
							className="
                mt-4
                w-full
                bg-emerald-600
                hover:bg-emerald-500
                disabled:bg-emerald-900
                text-white
                py-3
                rounded
              "
						>
							{uploading
								? "Enviando..."
								: "Enviar PDF"}
						</button>

						{uploadMessage && (
							<p className="mt-3 text-sm text-gray-300">
								{uploadMessage}
							</p>
						)}

					</div>

					{/* Prompt */}
					<div className="bg-gray-900 border border-gray-800 rounded-xl shadow p-6">

						<h2 className="font-semibold mb-2">
							Prompt Consolidado
						</h2>

						<textarea
							readOnly
							value={prompt}
							className="
                w-full
                h-64
                border
                border-gray-700
                bg-gray-800
                text-gray-100
                rounded
                p-3
              "
						/>

						<button
							onClick={execute}
							disabled={loading}
							className="
                mt-4
                w-full
                bg-indigo-500
                hover:bg-indigo-400
                disabled:bg-indigo-800
                text-white
                py-3
                rounded
              "
						>
							{loading ? (
								<span className="inline-flex items-center gap-2">
									<span
										className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
										aria-hidden="true"
									/>
									Consultando IA...
								</span>
							) : (
								"Executar com IA"
							)}
						</button>

					</div>

				</div>

			</div>

			{/* Resultados */}


			<div className="bg-gray-900 border border-gray-800 rounded-xl shadow p-6 mt-8">

				<h3 className="font-semibold mb-3">
					Conteudo gerado pela IA (baseado no prompt e no PDF enviado)
				</h3>

				<pre className="whitespace-pre-wrap">
					{answer}
				</pre>
			</div>

		</div>
	);
}
