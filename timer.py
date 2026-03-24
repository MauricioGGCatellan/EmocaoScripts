import sqlite3
import pandas  
import json
import numpy as np 

def removeTimeOutliers(data):
    Q1 = data.quantile(0.25)
    Q3 = data.quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5*IQR
    upper = Q3 + 1.5*IQR
 
    upper_array = np.where(data>= upper)[0]
    lower_array = np.where(data <= lower)[0]

    data.drop(index=upper_array, inplace=True)
    data.drop(index=lower_array, inplace=True) 

#method: svm, knn ou rf
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
