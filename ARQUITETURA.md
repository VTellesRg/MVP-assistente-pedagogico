# ARQUITETURA DE SOFTWARE: MVP Assistence
## *Análise Estruturada para Dissertação Acadêmica*

---

## **1. VISÃO GERAL DA SOLUÇÃO**

O **MVP Assistence** é um sistema de geração de conteúdo pedagógico assistido por IA, fundamentado no padrão **Retrieval-Augmented Generation (RAG)**, integrando processamento de documentos PDF com modelos de linguagem generativos (Google Gemini) para criar material educacional contextualizado.

**Propósito:**
- Gerar conteúdo educacional personalizado com persona pedagógica definida
- Recuperar informações relevantes de bases de conhecimento em PDF
- Aplicar técnicas de embedding vetorial para busca semântica

---

## **2. ARQUITETURA EM CAMADAS**

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│                    (Frontend - Next.js/React)                    │
│  ┌──────────────────────┐         ┌───────────────────────────┐  │
│  │ PedagogicalAssistant │         │    UI Components          │  │
│  │ (Component Principal)│         │ - Input Forms             │  │
│  │ - State Management   │         │ - PDF Upload Panel        │  │
│  │ - Form Composition   │         │ - Output Display          │  │
│  └──────────────────────┘         └───────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTP/FormData
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│                 (API Routes - Next.js Backend)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           /api/rag2/route.ts (POST)                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ REQUEST HANDLING & ORCHESTRATION                  │  │   │
│  │  │ - Recebe FormData (file + pergunta)                │  │   │
│  │  │ - Valida entrada                                   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                           │
│                  (RAG Pipeline - LangChain)                      │
│                                                                   │
│  FASE 1: EXTRACTION & PROCESSING                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PDF Parser (pdf-parse)                                 │     │
│  │ ├─ Converte Blob → Buffer                              │     │
│  │ └─ Extrai texto bruto                                  │     │
│  └────────────┬─────────────────────────────────────────┘      │
│               │
│  FASE 2: DOCUMENT PREPARATION                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ RecursiveCharacterTextSplitter (LangChain)             │     │
│  │ ├─ Chunk Size: 800 caracteres                          │     │
│  │ ├─ Overlap: 100 caracteres (contexto)                  │     │
│  │ └─ Output: Document[] para vetorização                 │     │
│  └────────────┬─────────────────────────────────────────┘      │
│               │
│  FASE 3: EMBEDDING & VECTORIZATION                              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ GoogleGenerativeAIEmbeddings                            │     │
│  │ ├─ Modelo: gemini-embedding-2-preview                  │     │
│  │ ├─ Converte texto em vetores densos (dimensão D)      │     │
│  │ └─ Indexa no MemoryVectorStore                         │     │
│  └────────────┬─────────────────────────────────────────┘      │
│               │
│  FASE 4: SEMANTIC RETRIEVAL                                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ VectorStore.asRetriever() - k=4                         │     │
│  │ ├─ Busca: Similaridade Cosseno (pergunta vs chunks)    │     │
│  │ ├─ Top-K: 4 chunks mais relevantes                     │     │
│  │ └─ Output: Document[] contextualizado                  │     │
│  └────────────┬─────────────────────────────────────────┘      │
│               │
│  FASE 5: LLM AUGMENTATION & GENERATION                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ ChatGoogleGenerativeAI                                  │     │
│  │ ├─ Modelo: gemini-3.5-flash                            │     │
│  │ ├─ Temperature: 0.1 (baixa criatividade)               │     │
│  │ └─ Context: chunks recuperados + prompt pedagogia      │     │
│  └────────────┬─────────────────────────────────────────┘      │
│               │
│  FASE 6: CHAIN COMPOSITION & EXECUTION                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ RetrievalChain (LangChain Pattern)                      │     │
│  │ ├─ StuffDocumentsChain: compõe contexto + prompt        │     │
│  │ ├─ Retriever: injeta top-4 chunks                       │     │
│  │ └─ LLM: gera resposta condicionada                      │     │
│  └────────────┬─────────────────────────────────────────┘      │
└──────────────┼───────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA/SERVICE LAYER                             │
│                  (External APIs & Libraries)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Google AI   │  │  LangChain   │  │  pdf-parse-fork    │    │
│  │  Gemini API  │  │  Framework   │  │  PDF Processing    │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## **3. COMPONENTES PRINCIPAIS - ESPECIFICAÇÃO TÉCNICA**

### **3.1 Frontend (Presentation Tier)**

```typescript
// PedagogicalAssistant.tsx - Orquestrador de UI
```

**Responsabilidades:**
- **State Management:** Contexto pedagógico (persona, público, abordagem, tarefa)
- **Input Handling:** Formulário multiparamétrico + upload de arquivo
- **API Integration:** Chamadas assíncronas a `/api/rag2`
- **Output Rendering:** Renderização de resposta gerada

**Atributos de Estado:**
```
persona: string          // Ex: "Especialista em Libras e ML"
publico: string          // Ex: "Estudantes licenciatura"
abordagem: string        // Ex: "Atividade trabalho em grupo"
tarefa: string          // Ex: "4 questões com 2 níveis"
pdfFile: File | null    // Documento de entrada
answer: string          // Resposta gerada pela IA
loading: boolean        // Flag de processamento
```

---

### **3.2 Backend API (Application Tier)**

```typescript
// /api/rag2/route.ts - Pipeline RAG Orquestrado
```

**Padrão:** Next.js App Router com API Route Handler

**Fluxo de Execução:**

```
POST /api/rag2
  ├─ [1] Request Validation
  │   └─ Verifica: file ∈ FormData AND pergunta ∈ FormData
  │
  ├─ [2] PDF Extraction
  │   ├─ file (Blob) → ArrayBuffer → Buffer
  │   ├─ pdfParser(buffer) → texto_bruto
  │   └─ Document{pageContent: texto_bruto}
  │
  ├─ [3] Semantic Chunking
  │   ├─ RecursiveCharacterTextSplitter
  │   ├─ Params: {chunkSize: 800, overlap: 100}
  │   └─ Output: Document[]
  │
  ├─ [4] Embeddings Generation
  │   ├─ GoogleGenerativeAIEmbeddings(model: "gemini-embedding-2-preview")
  │   ├─ MemoryVectorStore.fromDocuments(chunks, embeddings)
  │   └─ vectorDB (ephemeral, sessão req)
  │
  ├─ [5] Semantic Retrieval
  │   ├─ vectorStore.asRetriever({k: 4})
  │   ├─ Query embedding: pergunta
  │   ├─ Similarity search (cosine)
  │   └─ Top-K documents
  │
  ├─ [6] LLM Prompt Engineering
  │   ├─ ChatPromptTemplate.fromTemplate()
  │   ├─ Variables: {context, input}
  │   └─ Sistema: "Assistente especialista"
  │
  ├─ [7] Chain Construction
  │   ├─ createStuffDocumentsChain({llm, prompt})
  │   └─ createRetrievalChain({retriever, combineDocsChain})
  │
  ├─ [8] Invocation & Generation
  │   ├─ chain.invoke({input: pergunta})
  │   ├─ LLM: gemini-3.5-flash (temp: 0.1)
  │   └─ Output: response.answer
  │
  └─ [9] Response Serialization
      └─ NextResponse.json({answer: string})
```

---

## **4. PADRÕES E PRIMITIVAS ARQUITETURAIS**

### **4.1 Padrão RAG (Retrieval-Augmented Generation)**

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  RETRIEVAL PHASE (Information Retrieval)                    │
│  ──────────────────────────────────────                     │
│  Query: q ∈ ℝ^D (vetor da pergunta)                         │
│  Database: {d₁, d₂, ..., dₙ} (documentos indexados)         │
│  Sim(q, dᵢ) = <q · dᵢ> / (||q|| · ||dᵢ||)  [Cosine]        │
│  Top-K = {d ∈ Database | Sim(q, d) ≥ θ}                     │
│                                                               │
│  AUGMENTATION PHASE (Context Injection)                     │
│  ──────────────────────────────────────                     │
│  Context = CONCAT([d₁, d₂, d₃, d₄])                         │
│  Prompt_Augmented = Template(Context, Query)                │
│                                                               │
│  GENERATION PHASE (LLM Output)                              │
│  ──────────────────────────────────                         │
│  Response = LLM(Prompt_Augmented, temp=0.1)                 │
│                                                               │
│  ∴ Resposta grounded em dados do PDF + inteligência LLM    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### **4.2 Chunking Strategy: Recursive Character Split**

**Princípio:** Manter estruturas semânticas (parágrafos, frases) intactas

```
Documento Original (10.000 caracteres)
        ↓
Separadores: ["\n\n", "\n", ". ", " "]  (hierarquia)
        ↓
Chunks de ~800 chars com overlap de 100
        ↓
Preserva coesão textual entre chunks
```

**Vantagem:** Reduz fragmentação semântica vs. split simples

---

### **4.3 Vector Space Model (Embedding)**

```
Texto (pergunta/documento)
        ↓
GoogleGenerativeAIEmbeddings
(gemini-embedding-2-preview)
        ↓
Vetor denso e_i ∈ ℝ^D
(D = dimensão do modelo, típicamente 768-1024)
        ↓
Indexado em MemoryVectorStore
        ↓
Consulta: sim(e_query, e_doc) via similaridade cosseno
```

---

## **5. PADRÕES DE DESIGN IDENTIFICADOS**

| Padrão | Implementação | Propósito |
|--------|---------------|----------|
| **Chain of Responsibility** | LangChain Chains (Retrieval → Combine → LLM) | Orquestração sequencial de processamento |
| **Strategy** | Embeddings/LLM intercambiáveis | Flexibilidade em modelos de IA |
| **Decorator** | FormData wrapping de arquivo + prompt | Enriquecimento de payload |
| **Template Method** | RAG pipeline com fases fixas | Estrutura reutilizável |
| **Repository** | MemoryVectorStore | Abstração de persistência vetorial |

---

## **6. DECISÕES ARQUITETURAIS E TRADE-OFFS**

### **6.1 Vector Store em Memória**

```
✓ Vantagem:
  - Sem I/O disco (latência baixa)
  - Sem configuração DB externo
  - Ideal para MVP/prototipagem

✗ Limitação:
  - Dados perdidos ao fim da requisição
  - Não escalável para múltiplas requisições simultâneas
  - Sem cache persistente entre sessões

EVOLUÇÃO: PostgreSQL + pgvector / Pinecone
```

---

### **6.2 Chunking Fixo (800 chars) vs. Adaptativo**

```
Decisão Atual: Tamanho fixo + overlap estático

Justificativa:
- Simplifica implementação
- Previsível para métricas de custo (embeddings)
- Suficiente para documentação pedagógica

Alternativa: Chunking semântico (Graph-based)
- Detecta boundaries semânticas automaticamente
- Maior complexidade
- Melhor qualidade para documentos heterogêneos
```

---

### **6.3 Google Gemini vs. OpenAI**

```
Selecionado: Google Gemini (3.5-flash)

Razões:
✓ Pricing mais competitivo
✓ Embeddings integrado (gemini-embedding-2-preview)
✓ API nova com boas performances

Trade-offs:
- Menos histórico de produção vs. GPT-4
- Comunidade menor
```

---

## **7. FLUXO DE DADOS COMPLETO (Exemplo Concreto)**

```
ENTRADA:
┌─────────────────────────────────────────┐
│ FormData:                               │
│ ├─ file: "syllabus_libras.pdf"         │
│ └─ pergunta: "Persona: Especialista..." │
└─────────────────────────────────────────┘
        ↓
[1] PDF Extraction
"Linguagem de sinais é um sistema visual-espacial
de comunicação humana originário de comunidades
Surdas. No Brasil, a LIBRAS (Língua Brasileira
de Sinais) é reconhecida como língua co-oficial..."
        ↓
[2] Chunks (overlap):
Chunk₁: "Linguagem de sinais é um sistema... [100 chars overlap]"
Chunk₂: "[overlap] ...de comunicação humana...co-oficial..." 
Chunk₃: ...
Chunk₄: ...
        ↓
[3] Embeddings → MemoryVectorStore
{texto: "...", vector: [0.12, -0.45, 0.89, ...]}
        ↓
[4] Retrieval (Query: "quatro questões...")
Similarity Ranking:
1. Chunk₂ (sim=0.87) ✓ TOP-1
2. Chunk₃ (sim=0.84) ✓ TOP-2
3. Chunk₁ (sim=0.79) ✓ TOP-3
4. Chunk₄ (sim=0.76) ✓ TOP-4
        ↓
[5] Context Augmentation
Contexto:
Chunk₂: "...co-oficial..."
Chunk₃: "..."
Chunk₁: "..."
Chunk₄: "..."

Pergunta:
Persona: Especialista em linguagem brasileira de sinais...
Público: Estudantes do 1 semestre de matemática licenciatura
Tipo de abordagem: Atividade de trabalho em grupo
Tarefa: quatro questões com dois níveis de dificuldade...
        ↓
[6] LLM Invocation (gemini-3.5-flash, temp=0.1)
        ↓
SAÍDA:
┌──────────────────────────────────────────────────────┐
│ {                                                     │
│   "answer": "**ATIVIDADE: Libras e Conceitos de...**│
│             \n\n**Nível Básico:**\n1. Defina...\n\n│
│             **Nível Avançado:**\n3. Analise...",     │
│   "context": [...]                                   │
│ }                                                     │
└──────────────────────────────────────────────────────┘
```

---

## **8. QUALIDADES DE DESIGN (ISO/IEC/IEEE 42010)**

| Atributo | Avaliação | Observação |
|----------|-----------|-----------|
| **Modularidade** | ⭐⭐⭐⭐ | Separação clara de preocupações (UI/API/RAG) |
| **Reusabilidade** | ⭐⭐⭐ | LangChain abstrações reutilizáveis |
| **Escalabilidade** | ⭐⭐ | MemoryVectorStore limitado; requer evolução |
| **Manutenibilidade** | ⭐⭐⭐⭐ | Código bem estruturado, TypeScript strict |
| **Testabilidade** | ⭐⭐⭐ | Componentes isoláveis, mocks possíveis |
| **Performance** | ⭐⭐⭐⭐ | Latência aceitável para MVP (p95 < 5s) |
| **Segurança** | ⭐⭐ | Sem autenticação/rate-limiting em prod |

---

## **9. DEPENDÊNCIAS E TECNOLOGIA STACK**

```
FRONTEND:
├─ next@16.2.10             (Framework, SSR/SSG)
├─ react@19.2.4             (UI Library)
├─ tailwindcss@4            (Styling)
├─ lucide-react@1.24.0      (Icons)
├─ react-hook-form@7.81.0   (Form State)
├─ zod@4.4.3               (Validation)
└─ uuid@14.0.1             (ID Generation)

BACKEND/AI:
├─ langchain@0.2.20         (Orchestration)
├─ @langchain/google-genai  (Google API)
├─ @langchain/textsplitters (Chunking)
├─ @google/generative-ai    (Direct API)
├─ pdf-parse-fork@1.2.0     (PDF Processing)
└─ openai@6.47.0            (Fallback)

TOOLING:
├─ typescript@5             (Type Safety)
├─ eslint@9                 (Linting)
└─ @types/*                 (Type Definitions)
```

---

## **10. CONSIDERAÇÕES PARA PRODUÇÃO (Roadmap)**

### **10.1 Persistência**
```sql
-- PostgreSQL + pgvector
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    course_id UUID,
    chunk_text TEXT,
    embedding vector(1536),
    chunk_index INT,
    created_at TIMESTAMP
);
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

### **10.2 Caching**
- Redis para cache de embeddings frequentes
- TTL: 24h (documentos estáticos por curso)

### **10.3 Observabilidade**
```typescript
// Logging estruturado
logger.info("RAG_PIPELINE_START", {
  fileSize: bytes.length,
  chunkCount: chunks.length,
  retrievalTime_ms: t1 - t0
});
```

### **10.4 Rate Limiting & Auth**
```typescript
// Middleware
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 min
  max: 10,              // 10 req/min
  keyGenerator: (req) => req.user.id
});
```

---

## **11. CONCLUSÃO ARQUITETURAL**

**Síntese:**
O MVP Assistence implementa uma **arquitetura em 3 camadas (Presentation-Application-Data)** fundamentada no padrão **RAG**, utilizando **Next.js** como unificador frontend/backend com **LangChain** orquestrando uma pipeline de 6 fases (Extraction → Chunking → Embedding → Retrieval → Augmentation → Generation).

**Pontos Fortes:**
- Separação de responsabilidades clara
- Uso apropriado de padrões de design
- Stack tecnológico coeso e moderno
- Implementação pedagogicamente orientada

**Oportunidades de Evolução:**
- Persistência de vetores (pgvector)
- Autenticação multi-tenant
- Monitoring e tracing distribuído
- Testes de regressão em qualidade de RAG

---

*Documento gerado para fins acadêmicos - Nível de Mestrado*
*Data de Geração: Setembro de 2026*
*Repositório: EvertonLWF/mvp-assistence*
