export async function askRag(
  question: string,
  topK = 3
) {
  /*
    1. Gerar embeddings
    2. Buscar no banco vetorial
    3. Montar contexto
    4. Chamar LLM
  */

  return {
    answer: "Resposta do modelo",
    context: []
  };
}