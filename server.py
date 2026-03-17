#fastapi
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from videoToFrames import videoToFrames
from videoToFrames import getInitTimestamp
from facialExpressionAnalysis import framesAnalyze 
from HeartRateAnalysis.HRSupervisedAnalysis import HRAnalyze

import os
import json
  
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
    frameCount = 0
    directory_path = "./frames"
    if not any(os.scandir(directory_path)):
        frameCount = videoToFrames(videoName)
    else:
        frameCount = len([name for name in os.listdir(directory_path) if os.path.isfile(os.path.join(directory_path, name))])
    
 
    output_path = "./ferdata/ferData.json"
    if not os.path.isfile(output_path):
        initTimeStamp = getInitTimestamp()
        emoData = framesAnalyze(frameCount, 60, initTimeStamp)
    else:
        with open(output_path, 'r') as f:
            emoData = json.load(f)

    return emoData

@app.get("/hr/{method}")
def hr_analyze(method):
    output_path = "./HeartRateAnalysis/HR_output.json"
    if not os.path.isfile(output_path):
        emoData = HRAnalyze(method)
    else:
        with open(output_path, 'r') as f:
            emoData = json.load(f)
    print(emoData)
    return emoData