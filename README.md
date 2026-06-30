# RedactAI - Privacy Dashboard

RedactAI is a powerful, full-stack application designed to automatically detect and redact Personally Identifiable Information (PII) from text documents, scanned PDFs, and DOCX files. It uses advanced LLMs via Groq to identify sensitive information contextually and provides a robust visual interface for user validation.

## 🚀 Key Features
* **Automated PII Detection**: Context-aware detection using LLMs (Llama 3.3).
* **Multi-Format Support**: Process raw text, DOCX files, and PDF documents.
* **Vector-based PDF Redaction**: Physically burns redaction boxes into PDFs using PyMuPDF.
* **Trust Dashboard**: View breakdown of detected categories, confidence scores, and safety ratings.
* **Explainability Engine**: Get AI-generated reasoning for why a specific redaction was made.
* **Manual Overrides**: Click and drag over any missed text to forcefully redact it, or click any AI redaction to keep it visible.

---

## 🛠️ Onboarding Guide & Local Setup

This project uses a decoupled architecture with a React (Vite) frontend and a FastAPI backend.

### Prerequisites
* Node.js (v18+)
* Python (3.10+)
* A [Groq API Key](https://console.groq.com/keys)

### 1. Backend Setup (FastAPI)
The backend handles document parsing, vector PDF manipulation, and AI inference.

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install requirements
pip install -r requirements.txt

# Environment Setup
# Create a .env file in the backend directory and add your key:
echo "GROQ_API_KEY=your_key_here" > .env

# Run the server
uvicorn app.main:app --reload --port 8000
```
The backend will run on `http://localhost:8000`. API documentation is automatically generated at `http://localhost:8000/docs`.

### 2. Frontend Setup (React / Vite)
The frontend provides the visual document viewer and Trust Dashboard.

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will be available at `http://localhost:5173`. 

### System Architecture
* **Frontend**: React, Vite, PDF.js (for rendering document text layers natively in the browser).
* **Backend**: FastAPI, PyMuPDF (for physically blacking out PDF vector layers), Python-Docx.
* **AI Provider**: Groq (`llama-3.3-70b-versatile` for high-accuracy reasoning, falling back to `llama-3.1-8b-instant` if rate-limited).

## 🚢 Deployment
See the `DEPLOYMENT_GUIDE.md` in this repository for step-by-step instructions on hosting the backend on Render and the frontend on GitHub Pages.