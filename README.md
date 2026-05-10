# Evergreen Berry Harvest

Production-ready recruitment platform for a Finnish seasonal work company.

## Structure

- `frontend/` — React + Vite + Tailwind landing site and application form
- `backend/` — Node.js + Express API with MongoDB Atlas integration

## Features

- Modern Nordic-style responsive UI
- Application form with frontend and backend validation
- MongoDB applicant storage
- Security middleware: `helmet`, `cors`, rate limiting, sanitization, XSS protection
- GDPR-conscious privacy and terms pages
- Deployment-ready for Netlify and Render
- Scalable backend structure prepared for future authentication and email workflows

## Environment Variables

Create the values from `.env.example` in the relevant project folder.

### Backend

- `MONGO_URL`
- `DB_NAME`
- `PORT`
- `CLIENT_URL`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`

### Frontend

- `VITE_API_BASE_URL`

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment

- Frontend: deploy `frontend/` to Netlify
- Backend: deploy `backend/` to Render
- Set `CLIENT_URL` in the backend to your Netlify URL
- Set `VITE_API_BASE_URL` in the frontend to your Render API URL
- Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_JWT_SECRET` in Render for the backend

### Brevo (Transactional Email)

- In Render set the following environment variables for the backend service:
	- `BREVO_API_KEY` — your Brevo API key (keep secret)
	- `BREVO_SENDER_EMAIL` — the verified sender email in Brevo
	- `BREVO_SENDER_NAME` — sender display name
- Verify the sender email in your Brevo account before sending; otherwise deliveries will fail.

### Backend deployment checklist

- Ensure `backend/.env` is NOT committed — the repo's `.gitignore` already excludes `.env`.
- Use `backend/.env.example` as a template for the required variables.
- On Render set `MONGO_URL` (MongoDB Atlas), `DB_NAME`, `PORT` (optional), and `CLIENT_URL`.
- Ensure the backend `start` script runs `node server.js` (already set in `package.json`).

### Duplicate application prevention

- The backend enforces a unique index on `email` and rejects duplicate applications with HTTP 409.
- If a client tries to submit the same email twice, the API will return:

```json
{ "success": false, "message": "An application with this email address already exists" }
```

### Admin portal

- Visit `/admin` to sign in with the single admin account.
- The dashboard supports filtering by name, email, has car, driving license, and status.
- Click any applicant row to view details and change the application status.
- Recommended initial status flow: `pending` → `reviewed` → `selected` or `rejected`.

### Final notes

- Double-check environment variables are configured in the deployment provider UI and not stored in the repo.
- After deployment, test submitting an application and confirm you receive the Brevo confirmation email.

## Notes

- Do not commit real secrets.
- Use MongoDB Atlas connection strings only through environment variables.
- The authentication and email layers are intentionally structured for future expansion.
