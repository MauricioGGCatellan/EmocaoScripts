import sqlite3
import pandas  
import json
import numpy as np
from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier  

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
def HRAnalyze(method):
    #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
    dbname = "Gadgetbridge"
    con = sqlite3.connect(dbname)
    cursor = con.cursor()

    #Removendo artefatos de HR= 255 artifacts e ordenando por timestamp 
    cursor.execute("SELECT TIMESTAMP, HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 ORDER BY TIMESTAMP ASC")
    msr_data = cursor.fetchall()

    #Tratamento estatístico para remover outliers de timestamp
    timestamp_data = pandas.Series(x[0] for x in msr_data)

    print(timestamp_data)
    removeTimeOutliers(timestamp_data)

    valid_timestamps = set(timestamp_data)
    msr_data = [row for row in msr_data if row[0] in valid_timestamps]

    print(msr_data)

    #Ler CSV de dados de treino (WESAD)
    df = pandas.read_csv("HeartRateAnalysis/heart_rate_emotion_dataset.csv")
    
    x = df.drop('Emotion', axis=1)
    y = df['Emotion'] 

    #Aplicar algum algoritmo: RF,SVM e KNN
    if method == 'rf':
        clf = RandomForestClassifier()             
    elif method == 'svm':
        clf = svm.LinearSVC()
    elif method == 'knn':
        clf = KNeighborsClassifier()
    else:
        return {} 

    clf.fit(x, y)

    heart_rates = [row[1] for row in msr_data]
    heart_rates = np.array(heart_rates).reshape(-1, 1)  # formato 2D

    y_pred = clf.predict(heart_rates)

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

    return objs