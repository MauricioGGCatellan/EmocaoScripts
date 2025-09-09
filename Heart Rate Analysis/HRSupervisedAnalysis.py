import sqlite3
import pandas  

from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier  

#Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
dbname = "Gadgetbridge"
con = sqlite3.connect(dbname)
cursor = con.cursor()

#Removendo artefatos de HR= 255 artifacts e ordenando por timestamp 
cursor.execute("SELECT HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 AND TIMESTAMP > 1746368775 AND TIMESTAMP < 1746369082 ORDER BY TIMESTAMP ASC")
msr_data = cursor.fetchall()

#Print de debug
#print(msr_data)

#Ler CSV de dados de treino (WESAD)
df = pandas.read_csv("heart_rate_emotion_dataset.csv")
 
x = df.drop('Emotion', axis=1)
y = df['Emotion'] 

#Aplicar algum algoritmo: RF,SVM e KNN
#clf = RandomForestClassifier()             
#clf = svm.LinearSVC()
clf = KNeighborsClassifier()

clf.fit(x, y)
y_pred = clf.predict(msr_data)

#Imprimir predição de emoções
print(y_pred)