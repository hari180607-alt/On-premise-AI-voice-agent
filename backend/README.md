# AI Voice Agent Backend

Autonomous Customer Service and Appointment Management System - Phase 1 Backend Setup.

## Tech Stack
- **Python**: 3.13
- **Framework**: FastAPI
- **Database**: MongoDB Atlas (Async via Motor)
- **Settings & Validation**: Pydantic & Pydantic-Settings
- **Server**: Uvicorn

## Directory Structure
```
backend/
├── app/
│   ├── main.py          # Application entrypoint & FastAPI setup
│   ├── database.py      # Async MongoDB Motor connection client
│   ├── config.py        # Pydantic Settings management
│   ├── models/          # MongoDB / Database entities
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic controllers
│   └── utils/           # Utility functions & custom exception handlers
├── .env                 # Local environment configuration
├── .env.example         # Environment template
├── requirements.txt     # Python dependencies
└── README.md            # Documentation
```

## Setup & Running Locally

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create a Python Virtual Environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate Virtual Environment**:
   - Windows PowerShell:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - Linux/macOS:
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure Environment Variables**:
   Update `.env` with your MongoDB Atlas connection string:
   ```env
   MONGODB_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
   DATABASE_NAME="ai_voice_agent_db"
   ```

6. **Start Uvicorn Server**:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

7. **Interactive API Documentation (Swagger)**:
   Access interactive API docs at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
