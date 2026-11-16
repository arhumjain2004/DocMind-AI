# DocMind AI

## Intelligent RAG Document Assistant

DocMind AI is a full-stack application for uploading PDFs, generating study material, and asking questions grounded in a selected document. It extracts and stores page-aware text chunks, retrieves relevant evidence for questions, and displays source excerpts with page references.

## Features

- User registration, login, JWT-protected routes, and profile access.
- PDF upload, processing status, document listing, and deletion.
- AI-generated document summaries. The Insights page is the current summary-generation interface; there is no separate insights-generation API.
- Document Q&A using retrieval-augmented generation (RAG).
- Retrieved source excerpts with page numbers and similarity scores.
- Quiz generation with five questions and four answer options per question.
- Flashcard generation with ten cards.
- A shared Insights, Quiz, Flashcards, and Chat workspace for document study and analysis.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Axios, Tailwind CSS 4, Lucide React |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Vector database | Qdrant (`docmind_chunks`, 384-dimensional cosine vectors) |
| Embeddings | Transformers.js with `Xenova/all-MiniLM-L6-v2` |
| LLM | Ollama with `llama3.2:3b` |
| PDF extraction | `pdf-parse` |

## Architecture and RAG workflow

1. The authenticated upload endpoint validates the PDF MIME type, extension, and `%PDF-` signature, then extracts text and individual pages with `pdf-parse`.
2. Each page is divided into chunks of up to 1,000 characters with a 200-character overlap. Chunk records preserve their page numbers.
3. The backend generates 384-dimensional normalized embeddings with Transformers.js and stores vectors in Qdrant with chunk text and document/user metadata. The document becomes `ready` only after indexing completes.
4. For a Chat question, the backend verifies document ownership and readiness, embeds the query, and searches Qdrant with both user and document filters. It requests the top three results and keeps scores at or above `0.195`.
5. The backend builds a bounded context from the retrieved chunks, retaining source labels, page numbers, and chunk metadata. The context limit is 6,000 characters.
6. Ollama receives the question and evidence in a structured RAG prompt. The prompt treats retrieved text as untrusted evidence, asks the model to abstain when evidence is insufficient, and constrains citations to supplied source labels.
7. The backend validates the structured response and source labels. The Chat API returns the answer and the retrieved source metadata; the frontend renders source excerpts, page numbers, and similarity scores.

Summaries use a dedicated hierarchical generation path for long documents. Quiz and Flashcards use separate structured generation paths. These study features operate on extracted document text and do not use the Chat retrieval flow.

## Project structure

```text
.
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── scripts/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── test/
│   ├── uploads/              # Runtime PDF storage; ignored by Git
│   ├── .env.example
│   └── package.json
└── .gitignore
```

## Prerequisites

- Node.js **20.19 or later in the 20.x line, or 22.12 or later**. These are the installed Vite 8 package's Node engine requirements; the project manifests do not currently declare an `engines` field. Node 22.12+ is a straightforward choice.
- npm.
- A MongoDB Atlas connection URI and an accessible database.
- A Qdrant Cloud cluster URL and API key. On backend startup, the server initializes the `docmind_chunks` collection and its `userId` and `documentId` payload indexes.
- Ollama installed and running, with the `llama3.2:3b` model available:

  ```sh
  ollama pull llama3.2:3b
  ```

## Local installation

Install the frontend and backend dependencies in their respective directories:

```sh
cd client
npm install
cp .env.example .env.local
```

```sh
cd server
npm install
cp .env.example .env
```

On Windows PowerShell, `Copy-Item .env.example .env.local` and `Copy-Item .env.example .env` can be used instead of `cp`.

Edit the copied environment files with your local configuration. Do not paste secrets into this README or commit local environment files.

## Environment configuration

The committed example files list the supported variables and safe placeholders.

### Backend: `server/.env`

| Variable | Purpose | Local example/default |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection URI | Replace the placeholder with your Atlas URI. |
| `JWT_SECRET` | Signs and verifies authentication tokens | Replace the placeholder with a long, random secret. |
| `QDRANT_URL` | Qdrant cluster endpoint | Replace the placeholder with your cluster URL. |
| `QDRANT_API_KEY` | Authenticates to Qdrant Cloud | Replace the placeholder with your private API key. |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `NODE_ENV` | Controls environment-specific behavior | `development`; use `production` when deployed. |
| `PORT` | Backend HTTP port | `5000` when unset. |

### Frontend: `client/.env.local`

| Variable | Purpose | Local example/default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |

Vite exposes variables prefixed with `VITE_` to browser code. Keep MongoDB, JWT, and Qdrant credentials in the backend environment only.

## Running locally

Start Ollama separately and ensure `llama3.2:3b` is available. Then run the backend and frontend in separate terminals.

**Terminal 1 — backend** (run from `server`, which also makes the relative `uploads/` path resolve to `server/uploads`):

```sh
cd server
npm run dev
```

**Terminal 2 — frontend:**

```sh
cd client
npm run dev
```

Vite normally serves the client at `http://localhost:5173`; the backend defaults to port `5000`. The backend health endpoint is `/api/health`.

## Testing, linting, and build

There are no `test` scripts in the package manifests. Run the existing Node built-in test suites from each package directory:

```sh
cd client
node --test test/*.test.cjs
npm run lint
npm run build
```

```sh
cd server
node --test test/*.test.js
```

## Deployment notes

- The Ollama request URL is currently hard-coded to `http://localhost:11434/api/chat`. For a remote deployment, Ollama must run alongside the backend so that this address resolves correctly, or the application needs an approved configurable inference integration.
- PDF uploads are stored on the backend's local filesystem under `uploads/`. Production hosting must provide durable storage at that path or the application must be adapted to use durable object storage. Ephemeral filesystems can lose uploaded PDFs during restarts or redeployments.
- MongoDB Atlas and Qdrant Cloud credentials and network access must be configured for the backend. The server connects to MongoDB and initializes Qdrant before it starts listening.
- Set `VITE_API_BASE_URL` to the deployed API base URL at frontend build time. Set `CLIENT_ORIGIN` to the exact deployed frontend origin; these URLs must match the production deployment.
- The repository currently contains no Dockerfile or deployment manifests. Hosting setup must account for the separate frontend and backend packages, the runtime PDF storage path, and the Ollama requirement.

## Security notes

- Keep `.env`, `.env.local`, and other environment-specific files private. The repository ignores environment files while allowing the sanitized `.env.example` templates.
- Use a unique, strong `JWT_SECRET` in each deployment and store backend credentials in the hosting provider's secret configuration.
- Never commit uploaded PDFs, extracted user content, or files from `server/uploads/`. The directory is ignored by Git; confirm that any alternate upload location is also excluded before publishing.
- Do not put backend credentials in `VITE_*` variables. Those values are part of the public frontend build.
