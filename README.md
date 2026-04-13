# Mediscribe SaaS

> AI-powered consultation assistant for doctors in private practice.

This SaaS application turns raw consultation notes — typed or dictated — into professional medical record summaries, actionable next steps, and patient-friendly emails, with one-click translation into 19 languages.

---

## Features

- **Professional summaries** — generates structured medical record summaries from consultation notes
- **Action items** — extracts clear next steps and follow-up actions for the doctor
- **Patient emails** — drafts patient-friendly email communications automatically
- **Audio dictation** — record consultation notes by voice; transcribed instantly via OpenAI Whisper
- **Multilingual letters** — translate patient emails into 19 languages with one click
- **Real-time streaming** — AI output streams token-by-token as it's generated
- **Subscription gating** — Clerk-powered authentication and plan protection

---

## Tech Stack


| Layer               | Technology                                                           |
| ------------------- | -------------------------------------------------------------------- |
| Frontend            | Next.js (Pages Router), TypeScript, Tailwind CSS                     |
| Backend             | FastAPI (Python), Uvicorn                                            |
| AI                  | OpenAI GPT-4o-mini (summaries, translation), Whisper (transcription) |
| Auth                | Clerk (authentication + subscription management)                     |
| Deployment — Vercel | Vercel (frontend) + Vercel Serverless Functions (API)                |
| Deployment — AWS    | Docker, AWS ECR, AWS App Runner                                      |


---

## Project Structure

```
saas/
├── api/
│   ├── index.py        # Vercel: FastAPI app (summary, transcribe, translate)
│   └── server.py       # AWS: FastAPI app + static file serving
├── pages/
│   ├── _app.tsx        # ClerkProvider wrapper
│   ├── _document.tsx   # HTML shell
│   ├── index.tsx       # Landing page
│   └── product.tsx     # Main consultation form (protected)
├── styles/
│   └── globals.css
├── public/
├── Dockerfile          # Multi-stage build (Next.js + Python)
├── requirements.txt    # Python dependencies
├── package.json        # Node dependencies
├── next.config.ts      # Static export config (for AWS)
└── vercel.json         # API route rewrites (for Vercel)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- A [Clerk](https://clerk.com) account
- An [OpenAI](https://platform.openai.com) API key

### 1. Clone the repo

```bash
git clone https://github.com/mrithwik/saas.git
cd saas
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
pip install -r requirements.txt
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URL=https://your-clerk-app.clerk.accounts.dev/.well-known/jwks.json
OPENAI_API_KEY=sk-...
```

> **Never commit `.env.local` or `.env` to version control.**

### 4. Run locally (development)

```bash
# Frontend (Next.js dev server)
npm run dev

# Backend (FastAPI — in a separate terminal)
uvicorn api.index:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000) for the frontend.

---

## Deployment

### Vercel

1. Push to GitHub — Vercel auto-deploys on every commit to `main`
2. Add environment variables in Vercel project settings
3. The `vercel.json` rewrites route `/api/*` calls to the FastAPI serverless function

### AWS (Docker + App Runner)

Full step-by-step instructions are in `[week1/day5.md](week1/day5.md)`.

**Quick reference — rebuild and redeploy after code changes:**

```bash
# Load env vars
export $(cat .env | grep -v '^#' | xargs)

# Build for Linux/AMD64 (required for AWS — critical for Apple Silicon Macs)
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  -t consultation-app .

# Push to ECR
docker tag consultation-app:latest $AWS_ACCOUNT_ID.dkr.ecr.$DEFAULT_AWS_REGION.amazonaws.com/consultation-app:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$DEFAULT_AWS_REGION.amazonaws.com/consultation-app:latest
```

Then go to AWS App Runner → select your service → **Deploy**.

---

## API Endpoints


| Method | Path                | Description                                   |
| ------ | ------------------- | --------------------------------------------- |
| `POST` | `/api/consultation` | Stream summary, next steps, and patient email |
| `POST` | `/api/transcribe`   | Transcribe audio dictation via Whisper        |
| `POST` | `/api/translate`    | Stream translated patient letter              |
| `GET`  | `/health`           | Health check (used by App Runner)             |


All endpoints require a valid Clerk JWT in the `Authorization: Bearer <token>` header.

---

## Supported Languages (Translation)

French · Spanish · Mandarin Chinese · Arabic · Hindi · Portuguese · German · Japanese · Korean · Italian · Russian · Polish · Ukrainian · Farsi · Turkish · Vietnamese · Tagalog · Punjabi · Urdu

---

## Environment Variables Reference


| Variable                            | Required | Description                                       |
| ----------------------------------- | -------- | ------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes      | Clerk publishable key (baked into frontend build) |
| `CLERK_SECRET_KEY`                  | Yes      | Clerk secret key (backend only)                   |
| `CLERK_JWKS_URL`                    | Yes      | Clerk JWKS URL for JWT verification               |
| `OPENAI_API_KEY`                    | Yes      | OpenAI API key for GPT-4o-mini and Whisper        |
| `DEFAULT_AWS_REGION`                | AWS only | AWS region (e.g. `us-east-1`)                     |
| `AWS_ACCOUNT_ID`                    | AWS only | 12-digit AWS account ID                           |


---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.