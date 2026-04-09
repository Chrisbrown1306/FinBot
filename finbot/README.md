# 💰 FinBot — Personal Finance AI Agent

> An agentic AI chatbot that reads your bank statements (CSV/PDF) and answers natural language questions about your spending using **LangChain + GPT-3.5 + FastAPI + React**.

![FinBot Preview](https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.1-1C3C3C?style=flat-square)](https://langchain.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--3.5-412991?style=flat-square&logo=openai)](https://openai.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python)](https://python.org/)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat** | Natural language queries about your spending powered by GPT-3.5 |
| 📎 **File Upload** | Upload real bank statements in CSV or PDF format |
| 📊 **Analytics** | Interactive donut chart + category breakdown with progress bars |
| 📋 **Transactions** | Browse all transactions with category tags and color-coded amounts |
| 🤖 **4 AI Tools** | Spending summary, savings advice, anomaly detection, monthly trends |
| 🧠 **Memory** | Multi-turn conversation with session-based history |
| 🎲 **Demo Mode** | Try instantly with 3 months of sample data — no upload needed |
| 🌙 **Dark UI** | Polished dark finance theme with smooth animations |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Custom CSS |
| **Backend** | Python, FastAPI, Uvicorn |
| **AI / Agents** | LangChain, OpenAI GPT-3.5-turbo |
| **File Parsing** | pdfplumber (PDF), csv (CSV) |
| **Deploy** | Vercel (frontend) + Railway (backend) |

---

## 🚀 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key → [platform.openai.com](https://platform.openai.com)

### 1. Clone & Backend

```bash
git clone https://github.com/omnaik/finbot.git
cd finbot/backend

pip install -r requirements.txt

# Set API key
export OPENAI_API_KEY=your-key-here       # Mac/Linux
set OPENAI_API_KEY=your-key-here          # Windows

python main.py
# API running at http://localhost:8000
```

### 2. Frontend

```bash
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## 💬 Example Queries

Once running, try asking:

- *"What did I spend the most on this month?"*
- *"How can I save more money?"*
- *"Show me my monthly spending trend"*
- *"Find any transactions above ₹5000"*
- *"What's my savings rate?"*
- *"Give me a budget breakdown"*

---

## 🤖 LangChain Agent Tools

| Tool | Description |
|------|-------------|
| `get_spending_summary` | Total spent/income + top categories |
| `get_savings_advice` | Savings rate + personalized 50/30/20 tips |
| `find_unusual_transactions` | Large transactions above a threshold |
| `get_monthly_trend` | Month-by-month bar chart in text |

---

## 📁 Project Structure

```
finbot/
├── backend/
│   ├── main.py              ← FastAPI + LangChain agent + 4 tools + PDF/CSV parser
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── App.jsx          ← Chat UI + Analytics + Transactions + File upload
│   │   ├── index.css        ← Global dark theme CSS variables
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── sample_statement.csv     ← Test file you can upload
├── .gitignore
└── README.md
```

---

## 📋 CSV Format (for upload)

```csv
Date,Description,Amount
2024-01-15,Swiggy order,-450
2024-01-01,Salary credit,55000
2024-01-10,Amazon purchase,-2300
```

> Negative = expense, Positive = income

---

## ☁️ Deploy

### Frontend → Vercel
1. Push to GitHub
2. Connect repo on [vercel.com](https://vercel.com)
3. Root Directory: `frontend`
4. Add env var: `VITE_API_URL=https://your-railway-url.up.railway.app`

### Backend → Railway
1. New Project → Deploy from GitHub repo
2. Root Directory: `backend`
3. Add env var: `OPENAI_API_KEY=your-key`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## 🔒 Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `OPENAI_API_KEY` | Backend | Your OpenAI API key |
| `VITE_API_URL` | Frontend | Your deployed backend URL |

---

## 👤 Author

**Om Naik**
- 📧 Email: [omnaik6969@gmail.com](mailto:omnaik6969@gmail.com)
- 🐙 GitHub: [@omnaik](https://github.com/Chrisbrown1306/FinBot)


---

## 📄 License

MIT License — free to use, modify, and distribute.
