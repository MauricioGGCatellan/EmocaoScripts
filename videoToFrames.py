import cv2 
import time
import os
from datetime import timedelta
import json

def getInitTimestamp():   
  #REVER IMPLEMENTAÇÃO
  
  return 0

def videoPolling(videoName, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        if os.path.isfile(videoName):
            return 0
        time.sleep(0.1)
    return 1

def videoToFrames(videoName, user):
  pollRes = videoPolling(videoName)

  if pollRes == 1:
     return {"res": {"count":0, "fps": 0}, "err": "Video nao encontrado"}

  vidcap = cv2.VideoCapture(videoName)
  success,image = vidcap.read()
  count = 0 

  fps = vidcap.get(cv2.CAP_PROP_FPS)  # frames por segundo do vídeo
  frame_interval = int(fps)  # 1 frame por segundo

  os.makedirs(f"frames_{user}", exist_ok=True)

  while success:
    if count % frame_interval == 0:
      cv2.imwrite("frames_" + user + "/frame%d.jpg" % count, image)     # save frame as JPEG file       

    success,image = vidcap.read()
    print('Read a new frame: ', success)
    count += 1
  
  with open("frames_" + user + "/meta.json", 'w') as f:
    json.dump({"count":count, "fps": frame_interval}, f, indent=4)


  return {"res":{"count":count, "fps": frame_interval} , "err": ""}

 