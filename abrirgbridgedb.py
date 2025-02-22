import sqlite3
import pandas  

from sklearn import svm 
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score, ConfusionMatrixDisplay
from sklearn.model_selection import RandomizedSearchCV 

con = sqlite3.connect("Gadgetbridge")
cursor = con.cursor()

#Removing HR= 255 artifacts and ordering by timestamp
cursor.execute("SELECT HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 ORDER BY TIMESTAMP ASC")
msr_data = cursor.fetchall()

#Ler CSV
df = pandas.read_csv("heart_rate_emotion_dataset.csv")

print(msr_data)

x = df.drop('Emotion', axis=1)
y = df['Emotion']
#print(x, y)

#Aplicar algum algoritmo: RF,SVM e KNN
#clf = RandomForestClassifier()
#clf = svm.LinearSVC()
clf = KNeighborsClassifier()

clf.fit(x, y)
y_pred = clf.predict(msr_data)

print(y_pred)