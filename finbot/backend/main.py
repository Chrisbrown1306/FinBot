import os
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdfplumber
import csv
from io import StringIO
from dotenv import load_dotenv
import openai
from fastapi import Form
# Load environment variables
load_dotenv()

# Set OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

if not openai.api_key:
    raise ValueError("OPENAI_API_KEY not set in .env file")

# Initialize FastAPI
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store transactions in memory per session
sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

class UploadResponse(BaseModel):
    message: str
    transaction_count: int

class ChatResponse(BaseModel):
    response: str
    session_id: str

# Helper function to parse CSV
def parse_csv(content: str):
    try:
        reader = csv.DictReader(StringIO(content))
        transactions = []

        for row in reader:
            # Normalize keys (lowercase)
            row = {k.lower(): v for k, v in row.items()}

            transactions.append({
                "date": row.get("date") or row.get("transaction date", ""),
                "description": row.get("description") or row.get("details", ""),
                "amount": float(row.get("amount") or row.get("debit") or 0)
            })

        return transactions

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
# Helper function to parse PDF
def parse_pdf(file_content: bytes):
    try:
        transactions = []
        with pdfplumber.open(file_content) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                # Try to extract simple transaction format
                lines = text.split('\n')
                for line in lines:
                    if ',' in line:
                        parts = line.split(',')
                        if len(parts) >= 3:
                            try:
                                transactions.append({
                                    "date": parts[0].strip(),
                                    "description": parts[1].strip(),
                                    "amount": float(parts[2].strip())
                                })
                            except:
                                pass
        return transactions if transactions else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF parsing error: {str(e)}")

# Helper function to analyze spending
def get_spending_summary(transactions):
    categories = {}
    for txn in transactions:
        desc = txn["description"].lower()
        
        # Simple category detection
        if any(word in desc for word in ["food", "swiggy", "zomato", "restaurant"]):
            category = "Food"
        elif any(word in desc for word in ["amazon", "flipkart", "shopping"]):
            category = "Shopping"
        elif any(word in desc for word in ["uber", "ola", "taxi", "gas", "fuel"]):
            category = "Transport"
        elif any(word in desc for word in ["electricity", "water", "bill"]):
            category = "Utilities"
        elif any(word in desc for word in ["netflix", "spotify", "gym"]):
            category = "Entertainment"
        else:
            category = "Other"
        
        if category not in categories:
            categories[category] = 0
        categories[category] += abs(txn["amount"])
    
    return categories

# Helper function to find unusual transactions
def find_unusual_transactions(transactions, threshold=5000):
    unusual = []
    for txn in transactions:
        if abs(txn["amount"]) > threshold:
            unusual.append(txn)
    return unusual

# Helper function to get monthly trend
def get_monthly_trend(transactions):
    monthly = {}
    for txn in transactions:
        month = txn["date"][:7]  # YYYY-MM
        if month not in monthly:
            monthly[month] = 0
        monthly[month] += abs(txn["amount"])
    return monthly

def get_ai_response(question, transactions):
    try:
        spending = get_spending_summary(transactions)
        total_spent = sum(spending.values())
        total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
        
        # If no transactions, return simple response
        if not transactions or total_spent == 0:
            return "No spending data available. Please upload a file first."
        
        # Analyze the question and respond accordingly
        question_lower = question.lower()
        
        # Question: "What did I spend the most on?"
        if any(word in question_lower for word in ["spent most", "highest spending", "biggest expense"]):
            top_category = max(spending.items(), key=lambda x: x[1])[0] if spending else "Unknown"
            top_amount = spending.get(top_category, 0)
            return f"You spent the most on **{top_category}** at **₹{top_amount:,.0f}**.\n\nYour spending breakdown:\n" + "\n".join([f"• {cat}: ₹{amt:,.0f}" for cat, amt in sorted(spending.items(), key=lambda x: x[1], reverse=True)])
        
        # Question: "How can I save more?"
        elif any(word in question_lower for word in ["save", "savings", "reduce spending", "budget"]):
            total = sum(spending.values())
            top_cat = max(spending.items(), key=lambda x: x[1])[0] if spending else "Unknown"
            top_amt = spending.get(top_cat, 0)
            savings_pct = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
            return f"Here's how you can save more:\n\n💡 **Current Savings Rate: {savings_pct:.1f}%**\n\n• Your biggest expense is **{top_cat}** (₹{top_amt:,.0f}). Try reducing this by 10-20%.\n• Track your spending daily to identify wasteful expenses.\n• Set a monthly budget and stick to it (try the 50/30/20 rule).\n• Use cashback and rewards programs."
        
        # Question: "Show my monthly trend"
        elif any(word in question_lower for word in ["monthly", "trend", "month", "over time"]):
            monthly = get_monthly_trend(transactions)
            trend_text = "\n".join([f"• {month}: ₹{amt:,.0f}" for month, amt in sorted(monthly.items())])
            return f"📅 **Your Monthly Spending Trend:**\n\n{trend_text}"
        
        # Question: "Find transactions above X"
        elif any(word in question_lower for word in ["above", "exceed", "more than", "large"]):
            threshold = 5000
            unusual = find_unusual_transactions(transactions, threshold)
            if unusual:
                unusual_text = "\n".join([f"• {t['date']}: {t['description']} - ₹{abs(t['amount']):,.0f}" for t in unusual])
                return f"🚨 **Large Transactions Above ₹{threshold:,}:**\n\n{unusual_text}"
            else:
                return f"No transactions above ₹{threshold:,} found."
        
        # Question: "What's my savings rate?"
        elif any(word in question_lower for word in ["savings rate", "save", "saving percentage"]):
            savings_rate = ((total_income - total_spent) / total_income * 100) if total_income > 0 else 0
            savings_amt = total_income - total_spent
            return f"💰 **Your Savings Metrics:**\n\n• **Savings Rate:** {savings_rate:.1f}%\n• **Total Income:** ₹{total_income:,.0f}\n• **Total Spent:** ₹{total_spent:,.0f}\n• **Amount Saved:** ₹{savings_amt:,.0f}\n\n✅ Good job tracking your finances!"
        
        # Question: "Give me a budget breakdown"
        elif any(word in question_lower for word in ["budget", "breakdown", "categories"]):
            breakdown = "\n".join([f"• {cat}: ₹{amt:,.0f} ({amt/total_spent*100:.1f}%)" for cat, amt in sorted(spending.items(), key=lambda x: x[1], reverse=True)])
            return f"📊 **Budget Breakdown:**\n\n{breakdown}"
        
        # Default: try OpenAI or return summary
        else:
            try:
                prompt = f"""User asked: {question}

Financial Data:
- Total spent: ₹{total_spent}
- Total income: ₹{total_income}
- Spending by category: {json.dumps(spending, indent=2)}
- Transactions: {len(transactions)}

Give a helpful 2-3 sentence financial response."""
                
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful financial advisor."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=150
                )
                
                return response['choices'][0]['message']['content']
            except Exception as ai_error:
                print(f"⚠️ OpenAI Error: {str(ai_error)}")
                # Generic response if OpenAI fails
                return f"Based on your transactions:\n- Total spent: ₹{total_spent:,.0f}\n- Total income: ₹{total_income:,.0f}\n- Transactions: {len(transactions)}\n\nAsk me: 'What did I spend the most on?' or 'How can I save more?'"
            
    except Exception as e:
        print(f"❌ Error in get_ai_response: {str(e)}")
        return f"Error analyzing spending: {str(e)}"
# Routes
@app.get("/")
def read_root():
    return {"message": "FinBot API running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(default="default")):
   
    if not session_id or session_id == "default":
        session_id = "default"
    try:
        print("📂 File:", file.filename)

        content = await file.read()

        if file.filename.endswith(".csv"):
            content_str = content.decode('utf-8')
            print("📄 CSV Preview:", content_str[:100])
            transactions = parse_csv(content_str)

        elif file.filename.endswith(".pdf"):
            transactions = parse_pdf(content)

        else:
            raise HTTPException(status_code=400, detail="Only CSV and PDF files supported")

        print("✅ Transactions parsed:", len(transactions))

        if session_id not in sessions:
            sessions[session_id] = []

        sessions[session_id] = transactions

        return UploadResponse(
            message=f"Successfully uploaded {len(transactions)} transactions",
            transaction_count=len(transactions)
        )

    except Exception as e:
        print("❌ ERROR:", str(e))   # 👈 THIS IS KEY
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        session_id = request.session_id
        
        if session_id not in sessions or not sessions[session_id]:
            return {"error": "No transactions uploaded. Please upload a file first."}
        
        transactions = sessions[session_id]
        response = get_ai_response(request.message, transactions)
        
        return {
            "response": response,
            "session_id": session_id,
            "success": True
        }
    except Exception as e:
        print(f"❌ Chat Error: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }
@app.get("/transactions")
def get_transactions(session_id: str = "default"):
    if session_id not in sessions:
        return {"transactions": []}
    
    return {"transactions": sessions[session_id]}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
# Sample demo data
DEMO_DATA = [
    {"date": "2024-01-01", "description": "Salary Deposit", "amount": 55000},
    {"date": "2024-01-02", "description": "Amazon Purchase", "amount": -2300},
    {"date": "2024-01-03", "description": "Swiggy Food Order", "amount": -450},
    {"date": "2024-01-05", "description": "Mobile Recharge", "amount": -500},
    {"date": "2024-01-07", "description": "Netflix Subscription", "amount": -199},
    {"date": "2024-01-10", "description": "Electricity Bill", "amount": -1200},
    {"date": "2024-01-12", "description": "Starbucks Coffee", "amount": -250},
    {"date": "2024-01-15", "description": "Zomato Food", "amount": -680},
    {"date": "2024-01-18", "description": "Uber Rides", "amount": -900},
    {"date": "2024-01-20", "description": "Flipkart Electronics", "amount": -5000},
    {"date": "2024-01-22", "description": "Gym Membership", "amount": -1500},
    {"date": "2024-01-25", "description": "Restaurant Dinner", "amount": -2500},
    {"date": "2024-02-01", "description": "Salary Deposit", "amount": 55000},
    {"date": "2024-02-03", "description": "Amazon Purchase", "amount": -1500},
    {"date": "2024-02-05", "description": "Swiggy Food Order", "amount": -320},
    {"date": "2024-02-10", "description": "Insurance", "amount": -2000},
    {"date": "2024-02-15", "description": "Gas Station", "amount": -800},
    {"date": "2024-02-20", "description": "Groceries", "amount": -1200},
    {"date": "2024-03-01", "description": "Salary Deposit", "amount": 55000},
    {"date": "2024-03-05", "description": "Swiggy Food Order", "amount": -450},
]

@app.post("/load-demo")
def load_demo(session_id: str = "default"):
    """Load demo data for testing"""
    if session_id not in sessions:
        sessions[session_id] = []
    
    sessions[session_id] = DEMO_DATA
    
    return {
        "success": True,
        "message": f"Loaded {len(DEMO_DATA)} demo transactions",
        "transaction_count": len(DEMO_DATA)
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
