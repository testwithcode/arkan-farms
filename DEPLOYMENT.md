# Deployment

This project is split into:

- `backend`: FastAPI app for Railway
- `frontend`: Create React App for Vercel

## Backend on Railway

Create a Railway service from the `backend` folder.

Recommended Railway project settings:

- Root directory: `backend`
- Builder: Nixpacks
- Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/health`

Set these Railway environment variables:

```env
MONGO_URL=mongodb+srv://<user>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
DB_NAME=arkan_farms
JWT_SECRET=<generate-a-long-random-secret>
ADMIN_EMAIL=admin@poultry.com
ADMIN_PASSWORD=<change-this-password>
FRONTEND_URL=https://<your-vercel-app>.vercel.app
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

You can copy the same list from `backend/railway.env.example`.

Railway uses `backend/railway.json` and starts the API with:

```sh
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Health check:

```text
/api/health
```

## Frontend on Vercel

Create a Vercel project from the `frontend` folder.

Recommended Vercel project settings:

- Root directory: `frontend`
- Framework preset: Create React App
- Install command: `yarn install --frozen-lockfile`
- Build command: `yarn build`
- Output directory: `build`

Set this Vercel environment variable for Production, Preview, and Development:

```env
REACT_APP_BACKEND_URL=https://<your-railway-backend>.up.railway.app
```

You can copy the same variable from `frontend/vercel.env.example`.

Vercel uses `frontend/vercel.json`:

- install: `yarn install --frozen-lockfile`
- build: `yarn build`
- output: `build`

After Vercel gives you the frontend URL, update Railway:

```env
FRONTEND_URL=https://<your-vercel-app>.vercel.app
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
```

After Railway gives you the backend URL, update Vercel:

```env
REACT_APP_BACKEND_URL=https://<your-railway-backend>.up.railway.app
```

## Local Development

Keep local `.env` files pointed at local services:

- `frontend/.env`: `REACT_APP_BACKEND_URL=http://localhost:8000`
- `backend/.env`: `FRONTEND_URL=http://localhost:3000`, `CORS_ORIGINS=http://localhost:3000`, `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax`

Do not commit real `.env` files or secrets. The root `.gitignore` already ignores `.env`, `.env.*`, and `*.env`.
