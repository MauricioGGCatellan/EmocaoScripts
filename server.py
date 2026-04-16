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
@app.get("/face/{videoName}/{user}")
def face_analyze(videoName, user):
    frameCount = 0
    directory_path = "./frames_" + user
    if not os.path.exists(directory_path):
        os.mkdir(directory_path)
        framesObj = videoToFrames(videoName, user)
        if framesObj["err"] != "":
            return {"res": [], "err": framesObj["err"]}
        
        frameCount = framesObj["res"]
    else:
        frameCount = len([name for name in os.listdir(directory_path) if os.path.isfile(os.path.join(directory_path, name))])
    
 
    output_path = "./ferdata/" + user + "_ferData.json"
    if not os.path.exists(output_path):
        initTimeStamp = getInitTimestamp()
        emoData = framesAnalyze(user, frameCount, 60, initTimeStamp)
    else:
        with open(output_path, 'r') as f:
            emoData = json.load(f)

    return {"res": emoData, "err": ""}

@app.get("/hr/{method}/{user}")
def hr_analyze(method, user):
    output_path = "./HeartRateAnalysis/" + user + "_HR_output.json"
    print(os.path.exists(output_path))
    if not os.path.exists(output_path):
        emoData = HRAnalyze(method, user) 
        
        return emoData
    else:
        with open(output_path, 'r') as f:
            emoData = json.load(f)
            print(emoData)
            return {"res": emoData, "err": ""}