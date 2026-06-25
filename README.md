# AI-Powered Business Knowledge Verification Platform

An AI-first MVP that closes the loop between **raw internal knowledge → human-reviewed
questions → employee assessment → AI-graded results → knowledge-gap insight.**

The differentiator vs. a generic exam tool is the traceability chain:

```
Document → Knowledge Point → Question → Wrong Answer → Knowledge Gap
```

Every AI output is **visible, editable, and confirmable** before it reaches an employee.

---

## Tech stack

- **Backend:** FastAPI · SQLAlchemy 2.0 · Pydantic v2 · PostgreSQL · pypdf / python-docx
- **AI:** Anthropic Claude — Sonnet 4.6 for heavy reasoning (extraction, generation, subjective scoring); Haiku 4.5 for gap summarization. All calls use tool-use for structured JSON output.
- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind · shadcn-style components · TanStack Query

---

## Quickstart (Docker)

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=...

docker compose up
```

Then open:
- Frontend → http://localhost:3000
- Backend (OpenAPI) → http://localhost:8000/docs

The backend seeds three users (Content Admin, HR/Manager, Employee) and one sample
business document on first startup. Switch between them via the **role switcher** in
the top-right of the UI.

---

## Quickstart (local Python / Node)

Requires Python 3.11+, Node 20+, and a running PostgreSQL on `localhost:5432`.

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/kvp
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## The 7-minute demo path

1. **Admin role** — `/documents` → click the seeded *Wizlynn Customer Support Playbook*
   → **Extract**. ~10 seconds later, knowledge points appear.
2. **Admin role** — `/knowledge` → review the extracted KPs. **Approve** a handful (5+).
3. **Manager role** — switch via top-right dropdown → `/assessments/new`.
   - Title: *"Onboarding readiness check"*
   - Goal: *"Verify support agents understand the Wizlynn escalation tiers, refund windows, and customer-PIN verification flow."*
   - Target role: *Support agent* · Difficulty: *medium* · Count: *6*
   - Pick the Wizlynn document → **Create + generate**. Claude generates 6 mixed-type
     questions.
4. **Admin role** — switch back → `/assessments/[id]` → review questions. **Approve 4,
   reject 1, regenerate 1.** Regeneration produces a different question on the same KP.
5. **Manager role** — switch → **Publish**.
6. **Employee role** — switch → `/exam` → start the published exam → answer (intentionally
   miss one MCQ and write a weak open-ended answer) → submit.
7. **Results** — score, per-question feedback, AI rationale on the open-ended question,
   and the **gap panel** showing which knowledge points underly the wrong answers.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 14 · Tailwind · shadcn · TanStack Query             │
│  role switcher in header (X-User-Id header per request)      │
└─────────────────────────┬────────────────────────────────────┘
                          │ REST + JSON
┌─────────────────────────▼────────────────────────────────────┐
│  FastAPI                                                      │
│  routers/  →  services/  →  ai/  →  Anthropic SDK            │
│                                       (tool-use JSON)        │
└─────────────────────────┬────────────────────────────────────┘
                          │
                ┌─────────▼────────┐
                │   PostgreSQL     │
                │   8 tables       │
                └──────────────────┘
```

### Database (8 tables)

| Table | Purpose |
|---|---|
| `users` | Seeded: admin / manager / employee |
| `documents` | Uploaded files + parsed text + extraction status |
| `knowledge_points` | AI-extracted KPs (pending → approved/edited/rejected) |
| `assessments` | Exam goal, target role, difficulty, source docs |
| `assessment_documents` | M:N link |
| `questions` | Generated questions (4 types) with `source_kp_id` |
| `attempts` | Employee exam runs |
| `answers` | Per-question response + score + AI rationale |

Traceability is enforced by FK: `answer → question → knowledge_point → document`.

### AI layer

Located in `backend/app/ai/`:

- **`client.py`** — Anthropic client with tenacity-based retry. Every call uses
  `tool_choice={"type": "tool", ...}` so Claude is forced to return validated JSON
  matching the schemas in `tools.py`. Logs cache-read/cache-write tokens so you can
  verify prompt caching is working.
- **`tools.py`** — JSON schemas for `extract_knowledge`, `generate_questions`,
  `score_open`, `summarize_gaps`.
- **`prompts.py`** — All prompt templates. Extraction marks document text with
  `cache_control: {type: "ephemeral"}` so re-extraction on the same doc is ~90% cheaper.

### Services

- `extraction_service.py` — Parse → Claude → persist KPs as `pending`.
- `question_service.py` — Pull `approved`/`edited` KPs only; Claude generates a balanced
  pool. `regenerate_question()` rewrites a single question on the same KP.
- `scoring_service.py` — Deterministic Python for MCQ/multi/TF; Claude-graded for open.
  Returns `{score, rationale, evidence}` for every open answer.
- `gap_service.py` — SQL aggregates wrong answers by KP, severity assigned by threshold,
  then Haiku 4.5 labels each gap with a one-sentence theme.

---

## Project layout

```
.
├── README.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── deps.py
│       ├── seed.py
│       ├── models/
│       ├── schemas/
│       ├── routers/
│       ├── services/
│       └── ai/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.ts
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

---

## API surface

```
GET    /api/health
GET    /api/users
GET    /api/me
GET    /api/dashboard/stats

POST   /api/documents                  multipart upload (admin)
GET    /api/documents
GET    /api/documents/{id}
POST   /api/documents/{id}/extract     (admin)

GET    /api/knowledge-points?document_id=&status=
PATCH  /api/knowledge-points/{id}      approve/edit/reject (admin)
POST   /api/knowledge-points           manual create (admin)

POST   /api/assessments                (manager/admin)
GET    /api/assessments
GET    /api/assessments/{id}
POST   /api/assessments/{id}/generate  (manager/admin)
POST   /api/assessments/{id}/publish   (manager/admin)
GET    /api/assessments/{id}/coverage  KPs tested / not tested by this assessment

GET    /api/questions?assessment_id=&status=
PATCH  /api/questions/{id}             (admin)
POST   /api/questions/{id}/regenerate  (admin)

POST   /api/attempts                   {assessment_id}
GET    /api/attempts/{id}
POST   /api/attempts/{id}/answer       {question_id, answer_json}
POST   /api/attempts/{id}/submit
GET    /api/attempts/{id}/results
```

Auth is the simple role-switcher: clients send `X-User-Id: <id>`; the backend looks up
the user and gates routes via `require_role(...)`.

---

## What this MVP demonstrates

1. **AI extracts knowledge points** from business documents with verbatim source
   excerpts.
2. **AI generates assessment questions** that respect the exam goal and difficulty.
3. **Human reviewers can edit / approve / reject / regenerate** every AI output —
   nothing reaches employees unreviewed.
4. **Employees take assessments** with all four question types and autosave between
   answers.
5. **Objective questions auto-score** deterministically.
6. **Open-ended questions are AI-graded** with visible rationale and evidence.
7. **Knowledge gaps are identified** by walking `answer → question → KP → document`
   and labeled by an AI-generated theme.
8. **Personalized learning recommendations** — weak topics, this-week next steps,
   re-read suggestions — generated from the gap analysis.
9. **Knowledge coverage analysis** — % of approved KPs from the source documents
   actually tested by the assessment, with covered vs. uncovered breakdown.
10. **Results are linked to employee identity** via the role-switcher seed users.

---

## What is intentionally out of scope (roadmap)

- Embeddings / vector DB / RAG (using full-document Claude context instead)
- Real authentication, SSO, magic links
- LMS integration, department benchmarking, org-wide analytics
- Email notifications and reminders

The schema and folder structure leave clean hooks for these.
