import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

# Fetch DATABASE_URL from environment (e.g. Supabase connection string)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# SQLAlchemy 2.0 requires connection string to start with 'postgresql://' instead of 'postgres://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = None
SessionLocal = None

if DATABASE_URL:
    try:
        connect_args = {}
        if "supabase" in DATABASE_URL or "sslmode" in DATABASE_URL or not DATABASE_URL.startswith("sqlite"):
            connect_args = {"sslmode": "require"}
            
        engine = create_engine(
            DATABASE_URL,
            connect_args=connect_args if "sqlite" not in DATABASE_URL else {},
            pool_pre_ping=True,
            pool_recycle=300
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        print("SQLAlchemy database engine initialized successfully.", flush=True)
    except Exception as e:
        print(f"Database connection warning: {e}. Falling back to memory mode.", flush=True)
else:
    print("No DATABASE_URL supplied. Operating with transient state and cache.", flush=True)

def get_db():
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
