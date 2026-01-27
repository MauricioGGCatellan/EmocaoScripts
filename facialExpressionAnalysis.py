from deepface import DeepFace
import json 

#Real time a ser usado depois na prática:
#DeepFace.stream(db_path = "/mnt/c/database")           #Acho que já tenho que ter o db criado de antemão

def faceAnalyze(imgName, dataName, time):
    objs = {}
    try:
        objs = DeepFace.analyze(
            img_path = imgName, 
            actions = ['gender', 'race', 'emotion'],
        ) 
        
        #time é um marcador de timestamp com referencial no próprio vídeo
        objs.append({'timestamp': time})
        print(objs)

        with open(dataName, 'w') as f:
            json.dump(objs, f, indent=4)
        
        return objs
    except:
        print("Falhou em entender a foto!")
        return objs

def framesAnalyze(imgQuant, dataQuant):
    #Alterar imgQuant conforme numero de frames
    #imgQuant = 793

    #Alterar conforme quantidade de dados de heart rate. No caso: 803 = 6426/8
    #dataQuant = 1
    objs = []
    for i in range(1, imgQuant + 1, dataQuant):
        imgName = 'frames/frame' + str(i) + '.jpg'
        dataName = 'ferdata/data' + str(i) + '.json'
        obj = faceAnalyze(imgName, dataName, i)
        objs.append(obj)
    
    return objs