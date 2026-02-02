#fastapi
from typing import Union 
from fastapi import FastAPI

from videoToFrames import videoToFrames
from facialExpressionAnalysis import framesAnalyze 
from HeartRateAnalysis.HRSupervisedAnalysis import HRAnalyze

app = FastAPI()

#Desenvolver stub para testar 

@app.get("/")
def read_root():
    return {"Hello": "World"}

#videoName = '2025-06-26 11-19-28.mkv'
@app.get("/face/{videoName}")
def face_analyze(videoName):
    frameCount = videoToFrames(videoName)
    emoData = framesAnalyze(frameCount, 10)
    return emoData

@app.get("/hr/{method}")
def hr_analyze(method):
    return HRAnalyze(method)