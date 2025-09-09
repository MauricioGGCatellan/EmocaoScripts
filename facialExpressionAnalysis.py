from deepface import DeepFace
import json

#Real time a ser usado depois na prática:
#DeepFace.stream(db_path = "/mnt/c/database")           #Acho que já tenho que ter o db criado de antemão

def faceAnalyze(imgName, dataName):
    try:
        objs = DeepFace.analyze(
            img_path = imgName, 
            actions = ['gender', 'race', 'emotion'],
        )
        print(objs)
        with open(dataName, 'w') as f:
            json.dump(objs, f)
    except:
        print("Falhou em entender a foto!")
        return

#Alterar imgQuant conforme numero de frames
imgQuant = 6426

#Alterar conforme quantidade de dados de heart rate. No caso: 803 = 6426/8
dataQuant = 803
for i in range(1, imgQuant + 1, dataQuant):
    imgName = 'frame' + str(i) + '.jpg'
    dataName = 'data' + str(i) + '.json'
    faceAnalyze(imgName, dataName)