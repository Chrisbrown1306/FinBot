from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, re
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
import pdfplumber

app = FastAPI(title="FinBot – Personal Finance AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-key-here")

# ── In-memory store ──────────────────────────────────────────────────────────
transactions: list[dict] = []
chat_histories: dict[str, ChatMessageHistory] = {}


# ── Tools ────────────────────────────────────────────────────────────────────

@tool
def get_spending_summary(category: str = "all") -> str:
    """Get spending summary. Pass category name or 'all' for everything."""
    if not transactions:
        return "No transactions loaded yet. Please upload a bank statement first."
    filtered = (
        transactions
        if category == "all"
        else [t for t in transactions if t.get("category", "").lower() == category.lower()]
    )
    total = sum(t["amount"] for t in filtered if t["amount"] < 0)
    income = sum(t["amount"] for t in filtered if t["amount"] > 0)
    by_cat: dict[str, float] = {}
    for t in transactions:
        if t["amount"] < 0:
            cat = t.get("category", "Other")
            by_cat[cat] = by_cat.get(cat, 0) + abs(t["amount"])
    sorted_cats = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)
    result = f"Total spent: ₹{abs(total):.2f} | Income: ₹{income:.2f}\nTop categories:\n"
    for cat, amt in sorted_cats[:5]:
        result += f"  • {cat}: ₹{amt:.2f}\n"
    return result


@tool
def get_savings_advice(monthly_income: float = 0) -> str:
    """Get personalized savings advice based on spending patterns."""
    if not transactions:
        return "Upload transactions first."
    total_spent = sum(abs(t["amount"]) for t in transactions if t["amount"] < 0)
    income = monthly_income or sum(t["amount"] for t in transactions if t["amount"] > 0)
    savings_rate = ((income - total_spent) / income * 100) if income > 0 else 0
    by_cat: dict[str, float] = {}
    for t in transactions:
        if t["amount"] < 0:
            cat = t.get("category", "Other")
            by_cat[cat] = by_cat.get(cat, 0) + abs(t["amount"])
    top_expense = max(by_cat, key=by_cat.get) if by_cat else "Unknown"
    advice = f"Savings rate: {savings_rate:.1f}%\n"
    if savings_rate < 20:
        advice += (
            f"⚠️ You should save at least 20% of income. "
            f"Your top expense is {top_expense} (₹{by_cat.get(top_expense, 0):.0f}). "
            f"Consider reducing it by 15–20%.\n"
        )
    else:
        advice += "✅ Great savings rate! Consider investing surplus in index funds.\n"
    advice += "Tip: Apply the 50/30/20 rule — 50% needs, 30% wants, 20% savings."
    return advice


@tool
def find_unusual_transactions(threshold: float = 5000) -> str:
    """Find unusually large transactions above a threshold amount."""
    if not transactions:
        return "No transactions loaded."
    large = [t for t in transactions if abs(t["amount"]) > threshold]
    if not large:
        return f"No transactions above ₹{threshold}."
    result = f"Found {len(large)} large transactions:\n"
    for t in sorted(large, key=lambda x: abs(x["amount"]), reverse=True)[:10]:
        result += f"  • {t.get('date','?')} | {t.get('description','?')} | ₹{abs(t['amount']):.2f}\n"
    return result


@tool
def get_monthly_trend() -> str:
    """Get month-by-month spending trend."""
    if not transactions:
        return "No transactions loaded."
    monthly: dict[str, float] = {}
    for t in transactions:
        if t["amount"] < 0:
            try:
                month = t.get("date", "")[:7]
                monthly[month] = monthly.get(month, 0) + abs(t["amount"])
            except Exception:
                pass
    if not monthly:
        return "Could not parse monthly data."
    result = "Monthly spending trend:\n"
    for month in sorted(monthly.keys()):
        bar = "█" * int(monthly[month] / 1000)
        result += f"  {month}: ₹{monthly[month]:.0f} {bar}\n"
    return result


# ── LangChain Agent ──────────────────────────────────────────────────────────

tools = [get_spending_summary, get_savings_advice, find_unusual_transactions, get_monthly_trend]

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are FinBot, a friendly and smart personal finance AI assistant.
You help users understand their bank statements, track spending, and suggest savings strategies.
Be concise, use ₹ for Indian Rupees, and always be encouraging.
When you don't have data, ask the user to upload their bank statement.
Format responses with bullet points and emojis where helpful."""),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.3, api_key=OPENAI_API_KEY)
agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)


def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in chat_histories:
        chat_histories[session_id] = ChatMessageHistory()
    return chat_histories[session_id]


agent_with_history = RunnableWithMessageHistory(
    agent_executor,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def categorize(description: str) -> str:
    desc = description.lower()
    if any(w in desc for w in ["swiggy", "zomato", "restaurant", "cafe", "food", "pizza", "blinkit", "dunzo"]):
        return "Food & Dining"
    if any(w in desc for w in ["amazon", "flipkart", "shopping", "myntra", "meesho", "nykaa"]):
        return "Shopping"
    if any(w in desc for w in ["uber", "ola", "metro", "petrol", "fuel", "rapido", "irctc"]):
        return "Transport"
    if any(w in desc for w in ["netflix", "spotify", "prime", "hotstar", "youtube", "zee5"]):
        return "Entertainment"
    if any(w in desc for w in ["electricity", "water", "broadband", "recharge", "bill", "jio", "airtel"]):
        return "Utilities"
    if any(w in desc for w in ["salary", "credit", "neft", "transfer received", "imps received"]):
        return "Income"
    if any(w in desc for w in ["hospital", "pharmacy", "doctor", "medplus", "apollo"]):
        return "Healthcare"
    return "Other"


# ── Routes ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


@app.get("/")
def root():
    return {"status": "FinBot API running", "author": "Om Naik", "email": "omnaik6969@gmail.com"}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        result = agent_with_history.invoke(
            {"input": req.message},
            config={"configurable": {"session_id": req.session_id}},
        )
        return {"response": result["output"]}
    except Exception as e:
        return {"response": f"I encountered an error: {str(e)}. Please check your OpenAI API key."}


@app.post("/api/upload")
async def upload_statement(file: UploadFile = File(...)):
    global transactions
    transactions = []
    content = await file.read()

    if file.filename.endswith(".pdf"):
        import io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        lines = text.split("\n")
        for line in lines:
            amounts = re.findall(r"[-+]?\d{1,3}(?:,\d{3})*(?:\.\d{2})", line)
            if amounts:
                amt_str = amounts[-1].replace(",", "")
                try:
                    amount = float(amt_str)
                    date_match = re.search(r"\d{2}[/-]\d{2}[/-]\d{2,4}", line)
                    transactions.append({
                        "date": date_match.group() if date_match else "Unknown",
                        "description": line[:60].strip(),
                        "amount": -abs(amount) if "dr" in line.lower() else amount,
                        "category": categorize(line),
                    })
                except Exception:
                    pass

    elif file.filename.endswith(".csv"):
        import csv, io
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        for row in reader:
            desc = row.get("Description", row.get("Narration", ""))
            amt_str = row.get("Amount", row.get("Debit", "0")).replace(",", "")
            try:
                amount = float(amt_str)
                transactions.append({
                    "date": row.get("Date", ""),
                    "description": desc,
                    "amount": amount,
                    "category": categorize(desc),
                })
            except Exception:
                pass

    else:
        # Demo data
        transactions = [
            {"date": "2024-01", "description": "Swiggy order", "amount": -450, "category": "Food & Dining"},
            {"date": "2024-01", "description": "Salary credit", "amount": 55000, "category": "Income"},
            {"date": "2024-01", "description": "Amazon purchase", "amount": -2300, "category": "Shopping"},
            {"date": "2024-01", "description": "Netflix subscription", "amount": -649, "category": "Entertainment"},
            {"date": "2024-01", "description": "Electricity bill", "amount": -1200, "category": "Utilities"},
            {"date": "2024-01", "description": "Uber ride", "amount": -180, "category": "Transport"},
            {"date": "2024-01", "description": "Zomato order", "amount": -380, "category": "Food & Dining"},
            {"date": "2024-02", "description": "Salary credit", "amount": 55000, "category": "Income"},
            {"date": "2024-02", "description": "Flipkart purchase", "amount": -3200, "category": "Shopping"},
            {"date": "2024-02", "description": "Jio recharge", "amount": -299, "category": "Utilities"},
            {"date": "2024-02", "description": "Rapido ride", "amount": -120, "category": "Transport"},
            {"date": "2024-02", "description": "Hotstar subscription", "amount": -499, "category": "Entertainment"},
            {"date": "2024-02", "description": "Zomato order", "amount": -650, "category": "Food & Dining"},
            {"date": "2024-03", "description": "Salary credit", "amount": 55000, "category": "Income"},
            {"date": "2024-03", "description": "Hospital bill", "amount": -2500, "category": "Healthcare"},
            {"date": "2024-03", "description": "Amazon purchase", "amount": -1800, "category": "Shopping"},
            {"date": "2024-03", "description": "Swiggy order", "amount": -520, "category": "Food & Dining"},
            {"date": "2024-03", "description": "Electricity bill", "amount": -1350, "category": "Utilities"},
        ]

    return {"message": f"Loaded {len(transactions)} transactions", "count": len(transactions)}


@app.get("/api/transactions")
def get_transactions():
    return {"transactions": transactions[:50], "total": len(transactions)}


@app.get("/api/stats")
def get_stats():
    if not transactions:
        return {"total_spent": 0, "total_income": 0, "transaction_count": 0, "categories": {}}
    total_spent = sum(abs(t["amount"]) for t in transactions if t["amount"] < 0)
    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    by_cat: dict[str, float] = {}
    for t in transactions:
        if t["amount"] < 0:
            cat = t.get("category", "Other")
            by_cat[cat] = by_cat.get(cat, 0) + abs(t["amount"])
    return {
        "total_spent": round(total_spent, 2),
        "total_income": round(total_income, 2),
        "transaction_count": len(transactions),
        "categories": by_cat,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
