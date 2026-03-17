import cv2
import sqlite3 
from datetime import timedelta

def getInitTimestamp():
  #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
  dbname = "Gadgetbridge"
  con = sqlite3.connect(dbname)
  cursor = con.cursor()

  #Removendo artefatos de HR= 255 artifacts e ordenando por timestamp 
  cursor.execute("SELECT MIN(TIMESTAMP) FROM MI_BAND_ACTIVITY_SAMPLE")
  msr_data = cursor.fetchall()
  initTimeStamp = msr_data[0][0]
  print(initTimeStamp)

  return initTimeStamp

def videoToFrames(videoName):

  vidcap = cv2.VideoCapture(videoName)
  success,image = vidcap.read()
  count = 0
  
  while success:
    cv2.imwrite("frames/frame%d.jpg" % count, image)     # save frame as JPEG file      
    success,image = vidcap.read()
    print('Read a new frame: ', success)
    count += 1
  
  return count

 