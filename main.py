import json
import os
from urllib import error, request

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import get_db

AI_PROXY_URL = os.environ.get("INDRA_AI_PROXY_URL", "http://127.0.0.1:8787")
ADMIN_PASSWORD = os.environ.get("INDRA_ADMIN_PASSWORD", "")
 
# FastAPI 앱 인스턴스 생성 (서버의 본체)
app = FastAPI()
 
# CORS 설정 - 프론트에서 이 API를 호출할 수 있게 허용
# allow_origins=["*"] 는 모든 주소에서 허용, 나중에 프론트 주소로 좁히기
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
class AskRequest(BaseModel):
    password: str
    prompt: str
class TranslateItem(BaseModel):
    id: str
    text: str
class TranslateRequest(BaseModel):
    items: list[TranslateItem]
    targetLanguage: str = "Korean"
    tone: str | None = None

def post_to_ai_proxy(path: str, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{AI_PROXY_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8") or str(exc)
        raise HTTPException(status_code=502, detail=detail)
    except error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"AI proxy unavailable: {exc.reason}")

@app.post("/api/translate")
def translate(payload: TranslateRequest):
    proxy_payload = {
        "items": [item.model_dump() for item in payload.items],
        "targetLanguage": payload.targetLanguage,
    }

    if payload.tone:
        proxy_payload["tone"] = payload.tone

    return post_to_ai_proxy("/translate", proxy_payload)

@app.post("/api/ask")
def ask_ai(payload: AskRequest):
    if not ADMIN_PASSWORD or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않아요")
    return post_to_ai_proxy("/ask", {"prompt": payload.prompt})

# GET /tracks?artist=The Killers 형태로 호출하면 실행되는 함수
@app.get("/tracks")
def get_tracks(artist: str = Query(..., description="아티스트 이름")):
    # Query(...)에서 ...은 필수 파라미터라는 뜻
 
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM tracks
        WHERE artist = ?
        ORDER BY track_popularity DESC
    """, (artist,)).fetchall()
    # ?는 SQL 인젝션 방지를 위해 직접 문자열 넣는 대신 쓰는 방식
    conn.close()
 
    if not rows:
        raise HTTPException(status_code=404, detail="아티스트를 찾을 수 없어요")
 
    # 프론트에 JSON으로 돌려줌
    return {
        "artist": artist,
        "count": len(rows),
        "tracks": [dict(row) for row in rows]
    }

app.mount("/", StaticFiles(directory="static", html=True), name="static")
