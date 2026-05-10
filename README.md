 # Evergreen Recruitment Platform — Commercial Product

 Evergreen is a production-ready recruitment product built for seasonal workforce hiring. This
 repository contains the complete product (frontend + backend) that is ready to be sold, deployed,
 and operated for a client. The project was developed to be shipped to a paying customer under a
 commercial license.

 IMPORTANT: This repository includes a `LICENSE` file that specifies that the Software remains the
 property of the Owner until payment and a signed license agreement are executed. Do not assume any
 rights to use this product unless you have a written license from the Owner.

 Quick product summary
 - Product name: Evergreen Recruitment Platform
 - Purpose: Collect and manage seasonal worker applications (Finnish market-ready)
 - Stack: React + Vite + Tailwind (frontend) • Node.js + Express + MongoDB (backend)

 Key selling points
 - Turnkey applicant intake and admin dashboard for review and status updates
 - Finnish phone/email validation, GDPR-ready privacy/terms pages
 - Transactional confirmations via Brevo (configurable)
 - Secure, production-ready middleware (helmet, rate limiting, sanitization)
 - Easy deployment: frontend on Netlify (or any static host), backend on Render (or any Node host)

 What you get (deliverables)
 - Complete source code for frontend and backend (this repo)
 - Admin portal for screening and status management
 - Email confirmation integration and templating hooks
 - Deployment configs and example `.env` templates for Render & Netlify

 Demo / Trial
 - Run locally to demo the product to prospective buyers:

 ```powershell
 cd backend
 npm install
 npm run dev
 # in another shell
 cd frontend
 npm install
 npm run dev -- --host 0.0.0.0
 # open: http://localhost:5173 (use /admin for the dashboard)
 ```

 Production deployment (recommended)
 - Frontend: deploy `frontend/` to Netlify or similar. Set `VITE_API_BASE_URL` to the backend URL.
 - Backend: deploy `backend/` as a Web Service on Render (or similar):
	 - Root: `backend`
	 - Build: `npm install`
	 - Start: `node server.js`
	 - Required env vars: `MONGO_URL`, `DB_NAME`, `CLIENT_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`

 Licensing & Payment (important)
 - This product is sold subject to a license and payment. See `LICENSE` for the Owner's
	 reservation of rights until payment and a written license are completed.
 - Suggested process for selling to a client:
	 1. Provide a hosted demo (temporary credentials) and walkthrough.
	 2. Issue a written proposal and invoice with payment terms and a due date.
	 3. Upon receipt of full payment and execution of a license agreement, transfer or grant
			the agreed license/rights to the client.
 - If you require, we can supply a basic purchase-and-license contract template to present to the
	 client; for enforceable contracts consult a lawyer.

 Pricing & support (example placeholders)
 - One-time license fee: 600 €
 - Optional support / maintenance: 50 € — includes updates, small feature tweaks, and monitoring
 - Deployment assistance / onboarding: 50 €

 Admin & usage notes
 - Admin portal: visit `/admin` and sign in with the configured single admin account (set via env vars)
 - Page size and pagination are configurable; the backend supports large page sizes (up to 100)

 Security & secrets
 - Never commit real secrets. Use the provided `.env.example` files and set secrets in Render/Netlify.

 Next steps to sell this product
 1. Replace the placeholders below with your contact and pricing details.
 2. Prepare a short demo and proposal document for the prospective client.
 3. Use `LICENSE` and a written license/purchase agreement to capture the payment and grant rights.

 Contact / Owner
 - Owner: Seraj Shekh
 - Email: contact@serajshekh.fi

 Legal note
 - This README and the included `LICENSE` express the Owner's intent to retain ownership until
	 payment and a written license are completed. This is not a substitute for a proper contract.
	 For enforceable terms and jurisdiction-specific advice, consult a qualified attorney.

