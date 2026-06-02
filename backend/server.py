from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

JWT_ALGORITHM = "HS256"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "https://the-arkan-farms.vercel.app",
]
VERCEL_ORIGIN_REGEX = r"https://.*\.vercel\.app"

def get_cookie_settings() -> dict:
    return {
        "httponly": True,
        "secure": os.environ.get("COOKIE_SECURE", "false").lower() == "true",
        "samesite": os.environ.get("COOKIE_SAMESITE", "lax"),
        "path": "/"
    }

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class StockEntry(BaseModel):
    farm_id: str
    day: int
    date: str
    stock: int
    dead: int
    left: int
    notes: Optional[str] = ""

class StockEntryUpdate(BaseModel):
    day: Optional[int] = None
    date: Optional[str] = None
    stock: Optional[int] = None
    dead: Optional[int] = None
    left: Optional[int] = None
    notes: Optional[str] = None

class FeedEntry(BaseModel):
    farm_id: str
    date: str
    feed_name: str
    bags: int
    weight: float
    used: float
    remaining: float
    notes: Optional[str] = ""

class FeedEntryUpdate(BaseModel):
    date: Optional[str] = None
    feed_name: Optional[str] = None
    bags: Optional[int] = None
    weight: Optional[float] = None
    used: Optional[float] = None
    remaining: Optional[float] = None
    notes: Optional[str] = None

class InvoiceItem(BaseModel):
    product_name: str
    quantity: int
    rate: float
    total: float

class Invoice(BaseModel):
    invoice_number: str
    date: str
    customer_name: str
    mobile_number: str
    address: str
    farm_id: str
    items: List[InvoiceItem]
    subtotal: float
    gst_amount: float = 0
    total: float
    payment_status: str
    notes: Optional[str] = ""

class InvoiceUpdate(BaseModel):
    payment_status: Optional[str] = None
    notes: Optional[str] = None

@app.on_event("startup")
async def startup_db():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    # Performance indexes
    await db.stock_entries.create_index([("farm_id", 1), ("date", -1)])
    await db.stock_entries.create_index("created_at")
    await db.feed_entries.create_index([("farm_id", 1), ("date", -1)])
    await db.invoices.create_index([("date", -1)])
    
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@poultry.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "password_hash": hash_password(admin_password),
                "name": existing.get("name") or "Admin",
                "role": "admin",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        logger.info(f"Admin password updated")
    elif existing.get("role") != "admin":
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"role": "admin", "updated_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"Admin role updated: {admin_email}")
    
    farms_count = await db.farms.count_documents({})
    if farms_count == 0:
        farms = [
            {
                "name": "Badshah",
                "location": "Gitodiya",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "name": "Amayrah",
                "location": "Narsanda",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "name": "Qismat",
                "location": "Jod",
                "created_at": datetime.now(timezone.utc)
            }
        ]
        await db.farms.insert_many(farms)
        logger.info("Farms seeded successfully")

@app.post("/api/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(req.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": req.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=900,
        **get_cookie_settings()
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=604800,
        **get_cookie_settings()
    )
    
    return {
        "id": user_id,
        "email": email,
        "name": req.name,
        "role": "user"
    }

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower()
    
    identifier = f"{request.client.host}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("locked_until"):
        locked_until = attempt["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user:
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"attempts": 1},
                "$set": {"last_attempt": datetime.now(timezone.utc)}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(req.password, user["password_hash"]):
        attempt_doc = await db.login_attempts.find_one({"identifier": identifier})
        attempts = attempt_doc["attempts"] if attempt_doc else 0
        attempts += 1
        
        if attempts >= 5:
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {
                    "$set": {
                        "attempts": attempts,
                        "locked_until": datetime.now(timezone.utc) + timedelta(minutes=15),
                        "last_attempt": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
            raise HTTPException(status_code=429, detail="Too many failed attempts. Account locked for 15 minutes.")
        else:
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {
                    "$set": {
                        "attempts": attempts,
                        "last_attempt": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=900,
        **get_cookie_settings()
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=604800,
        **get_cookie_settings()
    )
    
    return {
        "id": user_id,
        "email": email,
        "name": user.get("name", ""),
        "role": user.get("role", "user")
    }

@app.post("/api/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    cookie_settings = get_cookie_settings()
    response.delete_cookie(
        "access_token",
        path=cookie_settings["path"],
        secure=cookie_settings["secure"],
        httponly=cookie_settings["httponly"],
        samesite=cookie_settings["samesite"]
    )
    response.delete_cookie(
        "refresh_token",
        path=cookie_settings["path"],
        secure=cookie_settings["secure"],
        httponly=cookie_settings["httponly"],
        samesite=cookie_settings["samesite"]
    )
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@app.post("/api/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        email = user["email"]
        access_token = create_access_token(user_id, email)
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=900,
            **get_cookie_settings()
        )
        
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    reset_link = f"{os.environ.get('FRONTEND_URL')}/reset-password?token={token}"
    logger.info(f"Password reset link: {reset_link}")
    
    return {"message": "If the email exists, a reset link has been sent"}

@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    token_doc = await db.password_reset_tokens.find_one({"token": req.token})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    if token_doc["used"]:
        raise HTTPException(status_code=400, detail="Token already used")
    
    expires_at = token_doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    hashed = hash_password(req.new_password)
    await db.users.update_one(
        {"_id": token_doc["user_id"]},
        {"$set": {"password_hash": hashed}}
    )
    
    await db.password_reset_tokens.update_one(
        {"token": req.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

@app.get("/api/farms")
async def get_farms(user: dict = Depends(get_current_user)):
    farms = await db.farms.find({}, {"_id": 1, "name": 1, "location": 1}).to_list(100)
    for farm in farms:
        farm["id"] = str(farm.pop("_id"))
    return farms

@app.post("/api/stock")
async def create_stock_entry(entry: StockEntry, user: dict = Depends(get_current_user)):
    entry_dict = entry.model_dump()
    entry_dict["created_at"] = datetime.now(timezone.utc)
    result = await db.stock_entries.insert_one(entry_dict)
    entry_dict["id"] = str(result.inserted_id)
    entry_dict.pop("_id", None)
    return entry_dict

@app.get("/api/stock/{farm_id}")
async def get_stock_entries(farm_id: str, user: dict = Depends(get_current_user)):
    entries = await db.stock_entries.find({"farm_id": farm_id}).sort("date", -1).to_list(1000)
    for entry in entries:
        entry["id"] = str(entry.pop("_id"))
    return entries

@app.put("/api/stock/{entry_id}")
async def update_stock_entry(entry_id: str, update: StockEntryUpdate, user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    result = await db.stock_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry = await db.stock_entries.find_one({"_id": ObjectId(entry_id)})
    entry["id"] = str(entry.pop("_id"))
    return entry

@app.delete("/api/stock/{entry_id}")
async def delete_stock_entry(entry_id: str, user: dict = Depends(get_current_user)):
    result = await db.stock_entries.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}

@app.post("/api/feed")
async def create_feed_entry(entry: FeedEntry, user: dict = Depends(get_current_user)):
    entry_dict = entry.model_dump()
    entry_dict["created_at"] = datetime.now(timezone.utc)
    result = await db.feed_entries.insert_one(entry_dict)
    entry_dict["id"] = str(result.inserted_id)
    entry_dict.pop("_id", None)
    return entry_dict

@app.get("/api/feed/{farm_id}")
async def get_feed_entries(farm_id: str, user: dict = Depends(get_current_user)):
    entries = await db.feed_entries.find({"farm_id": farm_id}).sort("date", -1).to_list(1000)
    for entry in entries:
        entry["id"] = str(entry.pop("_id"))
    return entries

@app.put("/api/feed/{entry_id}")
async def update_feed_entry(entry_id: str, update: FeedEntryUpdate, user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    result = await db.feed_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry = await db.feed_entries.find_one({"_id": ObjectId(entry_id)})
    entry["id"] = str(entry.pop("_id"))
    return entry

@app.delete("/api/feed/{entry_id}")
async def delete_feed_entry(entry_id: str, user: dict = Depends(get_current_user)):
    result = await db.feed_entries.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}

@app.post("/api/invoices")
async def create_invoice(invoice: Invoice, user: dict = Depends(get_current_user)):
    invoice_dict = invoice.model_dump()
    invoice_dict["created_at"] = datetime.now(timezone.utc)
    invoice_dict["created_by"] = user["id"]
    result = await db.invoices.insert_one(invoice_dict)
    invoice_dict["id"] = str(result.inserted_id)
    invoice_dict.pop("_id", None)
    return invoice_dict

@app.get("/api/invoices")
async def get_invoices(user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({}).sort("date", -1).to_list(1000)
    for invoice in invoices:
        invoice["id"] = str(invoice.pop("_id"))
    return invoices

@app.put("/api/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, update: InvoiceUpdate, user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    result = await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    invoice["id"] = str(invoice.pop("_id"))
    return invoice

@app.delete("/api/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    result = await db.invoices.delete_one({"_id": ObjectId(invoice_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    farms_count = await db.farms.count_documents({})
    
    # Use aggregation to get latest stock entry per farm in one query
    pipeline = [
        {"$sort": {"farm_id": 1, "date": -1}},
        {"$group": {
            "_id": "$farm_id",
            "left": {"$first": "$left"},
            "dead": {"$first": "$dead"}
        }}
    ]
    latest_stocks = await db.stock_entries.aggregate(pipeline).to_list(100)
    total_live_stock = sum(s.get("left", 0) for s in latest_stocks)
    total_dead = sum(s.get("dead", 0) for s in latest_stocks)
    
    # Single query for invoices stats
    invoice_pipeline = [
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_revenue": {"$sum": "$total"}
        }}
    ]
    invoice_stats = await db.invoices.aggregate(invoice_pipeline).to_list(1)
    total_invoices = invoice_stats[0]["count"] if invoice_stats else 0
    total_revenue = invoice_stats[0]["total_revenue"] if invoice_stats else 0
    
    # Get recent stock activities with farm names via aggregation
    activity_pipeline = [
        {"$sort": {"created_at": -1}},
        {"$limit": 5},
        {"$addFields": {"farm_oid": {"$toObjectId": "$farm_id"}}},
        {"$lookup": {
            "from": "farms",
            "localField": "farm_oid",
            "foreignField": "_id",
            "as": "farm"
        }},
        {"$project": {
            "_id": 0,
            "date": 1,
            "farm_name": {"$arrayElemAt": ["$farm.name", 0]}
        }}
    ]
    recent_stock = await db.stock_entries.aggregate(activity_pipeline).to_list(5)
    recent_activities = [
        {
            "type": "stock",
            "message": f"Stock updated for {entry.get('farm_name', 'Unknown')}",
            "date": entry.get("date", "")
        }
        for entry in recent_stock
    ]
    
    return {
        "total_farms": farms_count,
        "total_live_stock": total_live_stock,
        "total_dead": total_dead,
        "total_invoices": total_invoices,
        "total_revenue": total_revenue,
        "recent_activities": recent_activities
    }

def get_cors_origins() -> List[str]:
    configured_origins = os.environ.get("CORS_ORIGINS")
    origins = DEFAULT_CORS_ORIGINS.copy()
    origins.extend([
        origin.strip().rstrip("/")
        for origin in (configured_origins.split(",") if configured_origins else [])
        if origin.strip()
    ])
    frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)
    return list(dict.fromkeys(origins))

cors_origins = get_cors_origins()

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=VERCEL_ORIGIN_REGEX,
    allow_credentials="*" not in cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
