import sqlite3
import pandas  
import json
import numpy as np
import os
import time
from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier  
from sklearn.preprocessing import StandardScaler

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

def dbPolling(timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        if os.path.isfile("Gadgetbridge"):
            return 0
        time.sleep(0.1)
    return 1

#method: svm, knn ou rf
def HRAnalyze(method):
    #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
    pollRes = dbPolling()

    if pollRes == 1:
        return {"res": [], "err": "DB não existe."}
    
    dbname = "Gadgetbridge"
    con = sqlite3.connect(dbname)
    cursor = con.cursor()

    #Removendo artefatos de HR= 255 artifacts e ordenando por timestamp 
    cursor.execute("SELECT TIMESTAMP, HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 ORDER BY TIMESTAMP ASC")
    msr_data = cursor.fetchall()

    #Tratamento estatístico para remover outliers de timestamp
    timestamp_data = pandas.Series(x[0] for x in msr_data)
    hr_data = pandas.Series(x[1] for x in msr_data)

    print(timestamp_data)
    removeTimeOutliers(timestamp_data)
    removeTimeOutliers(hr_data)

    valid_timestamps = set(timestamp_data)
    valid_hrdata = set(hr_data)

    #Tratamento dados do usuario
    msr_data = [row for row in msr_data if row[0] in valid_timestamps and row[1] in valid_hrdata]

    df_msr = pandas.DataFrame(msr_data, columns=['timestamp', 'hr'])

    df_msr['hr_mean'] = df_msr['hr'].rolling(5).mean()
    df_msr = df_msr.dropna()
  
    #Ler CSV de dados de treino (WESAD)
    df = pandas.read_csv("HeartRateAnalysis/heart_rate_emotion_dataset.csv")
    
    #Resolvendo problema de pairing
    df['hr_mean'] = df['HeartRate'].rolling(5).mean()
    df = df.dropna()
    
    x_mean = df['hr_mean'] 
    y = df['Emotion'] 

    #Aplicar algum algoritmo: RF,SVM e KNN
    if method == 'rf':
        clf = RandomForestClassifier()             
    elif method == 'svm':
        clf = svm.SVC(kernel='linear', probability=True)
    elif method == 'knn':
        clf = KNeighborsClassifier()
    else:
        return {"res": [], "err": "Metodo invalido."} 
    
    scaler = StandardScaler() 
    
    x_mean_reshaped = np.array(x_mean).reshape(-1, 1)
    x_scaled = scaler.fit_transform(x_mean_reshaped)
    
    clf.fit(x_scaled, y)
    #N sei qual é melhor - heart_rates_scaled ou heart_rates 
    heart_rates_scaled = scaler.transform(df_msr[['hr_mean']])  
    y_pred = clf.predict(heart_rates_scaled)

    #Imprimir predição de emoções
    #print(y_pred)

    #Construir objetos para salvar como json
    objs = []
    i = 0

    for pred in y_pred:
        obj = {}
        obj['timestamp'] = msr_data[i][0]   #Consultar no sqlite
        obj['emotion'] = pred   #Navegar no vetor y_pred
        objs.append(obj)
        i = i + 1
 
    #Salvar objs como json
    file_path = "HeartRateAnalysis/HR_output.json"
    with open(file_path, "w") as json_file:
        json.dump(objs, json_file, indent=4)

    return {"res": objs, "err": ""}