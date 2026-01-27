import sqlite3
import pandas  
import json
import numpy as np
from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier  

#method: svm, knn ou rf
def HRAnalyze(method):
    #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
    dbname = "Gadgetbridge"
    con = sqlite3.connect(dbname)
    cursor = con.cursor()

    #Removendo artefatos de HR= 255 artifacts e ordenando por timestamp 
    cursor.execute("SELECT TIMESTAMP, HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 AND TIMESTAMP > 1746368775 AND TIMESTAMP < 1746369082 ORDER BY TIMESTAMP ASC")
    msr_data = cursor.fetchall()

    #Print de debug
    #print(msr_data)

    #Ler CSV de dados de treino (WESAD)
    df = pandas.read_csv("heart_rate_emotion_dataset.csv")
    
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
    file_path = "HR_output.json"
    with open(file_path, "w") as json_file:
        json.dump(objs, json_file, indent=4)

    return objs