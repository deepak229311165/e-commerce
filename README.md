# ShopSphere

FastAPI + MongoDB backend, React (Vite) frontend.

```
.
├── .env                # secrets / Mongo settings
├── app.env             # app name, host, port, CORS origin
├── requirements.txt
├── scripts/            # (empty for now)
├── src/
│   ├── config.py       # loads app.env + .env
│   ├── schema.py       # Pydantic models
│   ├── login.py        # /auth routes + JWT helpers
│   ├── main.py         # FastAPI app: /products, /cart, /dashboard
│   └── mongodb/
│       ├── users.py    # Mongo connection + users collection
│       └── cart.py     # carts collection
└── frontend/           # React app (Home long page + Dashboard)
```

## Run

Backend (needs MongoDB running on `MONGODB_URI`):

```bash
pip install -r requirements.txt
python -m src.main          # or: uvicorn src.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

API docs: http://localhost:8000/docs

Change `SECRET_KEY` in `.env` before deploying.