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

- `MONGODB_URI`
- `PORT`
- `CLIENT_URL`

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

## Notes

- Do not commit real secrets.
- Use MongoDB Atlas connection strings only through environment variables.
- The authentication and email layers are intentionally structured for future expansion.
