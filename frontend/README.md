# Frontend Development

This frontend is meant to run separately from the Dockerized backend during local development.

## Local Setup

From the repo root, start the backend stack first:

```bash
docker compose up --build
```

Then start the Next.js app in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Backend Endpoints Used by the Frontend

- Dashboard API: `http://localhost:8000`
- Ingestion control API: `http://localhost:8080`

## Notes

- The backend now runs independently from the frontend Docker build.
- Frontend edits should reload immediately through the Next.js dev server. The `npm run dev` script uses Next's webpack dev server for more reliable local hot reload behavior on this project.
- If you stop the backend, the frontend will stay up but live data and controls will be unavailable until Docker services are started again.
