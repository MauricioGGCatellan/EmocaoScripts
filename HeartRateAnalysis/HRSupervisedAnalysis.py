import pandas  
import json
import numpy as np
import os
import time
from datetime import datetime
from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier  
from sklearn.preprocessing import StandardScaler

def removeTimeOutliers(data):
    Q1 = data.quantile(0.1)
    Q3 = data.quantile(0.9)
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
        if os.path.isfile("HeartRateAnalysis/HEARTRATE_AUTO.csv"):
            return 0
        time.sleep(0.1)
    return 1

#method: svm, knn ou rf
def HRAnalyze(method, user):
    #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
    pollRes = dbPolling()

    if pollRes == 1:
        return {"res": [], "err": "DB não existe."}
     
    msr_data = pandas.read_csv("HeartRateAnalysis/HEARTRATE_AUTO.csv")

    #Tratamento estatístico para remover outliers de timestamp 
    hr_data = msr_data['heartRate'].copy()
 
    removeTimeOutliers(hr_data) 
    valid_hrdata = set(hr_data)

    #Tratamento dados do usuario
    msr_data = msr_data[msr_data['heartRate'].isin(valid_hrdata)]
    msr_data['hr_mean'] = msr_data['heartRate'].rolling(2).mean()
    msr_data = msr_data.dropna()
  
    #Ler CSV de dados de treino (WESAD)
    df = pandas.read_csv("HeartRateAnalysis/heart_rate_emotion_dataset.csv")
    
    #Resolvendo problema de pairing
    df['hr_mean'] = df['HeartRate'].rolling(2).mean()
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
    heart_rates_scaled = scaler.transform(msr_data[['hr_mean']])  
    y_pred = clf.predict(heart_rates_scaled)

    #Imprimir predição de emoções
    #print(y_pred)

    #Construir objetos para salvar como json
    objs = []
    i = 0

    for pred in y_pred:
        row = msr_data.iloc[i] 
        obj = {}
        date = row['date']
        time = " " + row['time']
        fulldate = datetime.strptime(date + time, "%Y-%m-%d %H:%M")
  
        obj['timestamp'] = fulldate.timestamp()
        obj['emotion'] = pred   #Navegar no vetor y_pred
        objs.append(obj)
        i = i + 1
 
    #Salvar objs como json
    file_path = "HeartRateAnalysis/" + user + "_HR_output.json"
    with open(file_path, "w") as json_file:
        json.dump(objs, json_file, indent=4)

    return {"res": objs, "err": ""}