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


imgQuant = 1038

for i in range(1, imgQuant + 1):
    imgName = 'frame' + str(i) + '.jpg'
    dataName = 'data' + str(i) + '.json'
    faceAnalyze(imgName, dataName)