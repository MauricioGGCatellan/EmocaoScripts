#fastapi
from typing import Union 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from videoToFrames import videoToFrames
from facialExpressionAnalysis import framesAnalyze 
from HeartRateAnalysis.HRSupervisedAnalysis import HRAnalyze

def stub():
    jsonData = [
        {
            "timestamp": 1746368750,
            "emotion": "fear"
        },
        {
            "timestamp": 1746368778,
            "emotion": "neutral"
        },
        {
            "timestamp": 1746368779,
            "emotion": "neutral"
        },
        {
            "timestamp": 1746368780,
            "emotion": "neutral"
        },
        {
            "timestamp": 1746368840,
            "emotion": "angry"
        },
        {
            "timestamp": 1746368841,
            "emotion": "angry"
        },]

    return jsonData

app = FastAPI()

origins = [
    "http://localhost:5173",   # Vite
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # NÃO use "*" em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}

#videoName = '2025-06-26 11-19-28.mkv'
@app.get("/face/{videoName}")
def face_analyze(videoName):
    #frameCount = videoToFrames(videoName)
    #emoData = framesAnalyze(frameCount, 10)

    emoData = stub()

    return emoData

@app.get("/hr/{method}")
def hr_analyze(method):
    #emoData = HRAnalyze(method)
    
    emoData = stub()
    
    return emoData