import sqlite3
import numpy as np
import matplotlib.pyplot as plt 
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd


def HRAnalyzeNonSup():
    #Mudar dbname conforme nome da base de dados (obs: deve ser SQLite)
    dbname = "Gadgetbridge"
    con = sqlite3.connect(dbname)
    cursor = con.cursor()

    #Removendo artefatos de HR= 255 artifacts e ordenando por timestamp
    cursor.execute("SELECT TIMESTAMP, HEART_RATE FROM MI_BAND_ACTIVITY_SAMPLE WHERE HEART_RATE < 255 ORDER BY TIMESTAMP ASC")
    msr_data = cursor.fetchall()
    
    X = np.array(msr_data) 
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Aplicar KMeans
    # 4 - 1 para cada quadrante do Russel
    kmeans = KMeans(n_clusters=4, random_state=42)
    kmeans.fit(X_scaled)
    
    labels = kmeans.labels_  
    df = pd.DataFrame(X, columns=['timestamp', 'HR'])
    df['Cluster'] = labels

    #print(df)

    # Visualizar os clusters em gráfico 2D
    #plt.scatter(X_scaled[:, 0], X_scaled[:, 1], c=labels, cmap='viridis')
    #plt.title("Clusters encontrados pelo KMeans")
    #plt.xlabel('timestamp (normalizado)')
    #plt.ylabel('HR (normalizado)')
    #plt.show()
