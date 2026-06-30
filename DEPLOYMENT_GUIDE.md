# RedactAI Deployment Guide

This guide covers deploying the frontend to **GitHub Pages** and the backend to **Render**.

## 1. Deploy the Backend to Render

1. Create a free account on [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your GitHub repository containing the RedactAI codebase.
4. Configure the Web Service:
   - **Name**: `redactai-backend` (or similar)
   - **Environment**: `Python 3`
   - **Region**: Any (e.g., Oregon)
   - **Branch**: `main`
   - **Root Directory**: `backend` *(Critical: This tells Render to only look at your Python folder)*
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**: Scroll down to the Environment variables section and add:
   - `GROQ_API_KEY`: *(Paste your Groq API Key here)*
6. Click **Create Web Service**. 
7. Once deployed, Render will give you a public URL (e.g., `https://redactai-backend-xxxxx.onrender.com`). **Copy this URL**.

## 2. Prepare the Frontend for Production

Before deploying the frontend, we need to tell it where the production backend lives.

1. Open your frontend `.env` file (or create one in `frontend/.env` if it doesn't exist).
2. Add your Render backend URL:
   ```env
   VITE_API_URL=https://redactai-backend-xxxxx.onrender.com/api
   ```
3. *(Important)*: Vite requires the `base` path in `vite.config.js` to be set to your repository name if hosting on GitHub Pages (e.g., if your repo is `github.com/ajeth/SprintFour`, set `base: '/SprintFour/'`).

## 3. Deploy the Frontend to GitHub Pages

1. In your terminal, navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the `gh-pages` deployment package:
   ```bash
   npm install gh-pages --save-dev
   ```
3. Open `frontend/package.json` and add a `predeploy` and `deploy` script inside the `"scripts"` block:
   ```json
   "scripts": {
     "dev": "vite",
     "build": "vite build",
     "preview": "vite preview",
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
4. Run the deployment command:
   ```bash
   npm run deploy
   ```
5. Go to your repository settings on GitHub -> **Pages**.
6. Under **Build and deployment**, ensure the source is set to **Deploy from a branch**.
7. Set the branch to **`gh-pages`** and the folder to **`/ (root)`**, then click Save.

Your frontend will be live on GitHub Pages in a few minutes, connecting securely to your Render-hosted Python backend!
