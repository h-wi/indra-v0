from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import get_db
 
# FastAPI 앱 인스턴스 생성 (서버의 본체)
app = FastAPI()
 
# CORS 설정 - 프론트에서 이 API를 호출할 수 있게 허용
# allow_origins=["*"] 는 모든 주소에서 허용, 나중에 프론트 주소로 좁히기
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
 
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
