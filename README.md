# fold-automation

RNA structure prediction pipeline — React frontend + Modal cloud backend.

## Stack
- **Frontend:** Vite + React + TypeScript + Tailwind v4 + shadcn/ui
- **Backend:** Modal (cloud) + FastAPI + ViennaRNA

## Development

### Backend (Modal)
```bash
pip install modal
modal serve backend/main.py
```

### Frontend
```bash
cd frontend
npm install
# Copy .env.local.example → .env.local and set VITE_MODAL_ENDPOINT
npm run dev
```

## Deploy
```bash
modal deploy backend/main.py
```
