from deepface import DeepFace 

import json 

#Real time a ser usado depois na prática:
#DeepFace.stream(db_path = "/mnt/c/database")           #Acho que já tenho que ter o db criado de antemão
 
def faceAnalyze(imgName, time, initTimeStamp):
    objs = {}
    jsonObj = {}
    try:
        objs = DeepFace.analyze(
            img_path = imgName, 
            actions = ['gender', 'race', 'emotion'],
            #model_name = "Facenet"
        ) 
        
        #time é um marcador de timestamp com referencial no próprio vídeo
        jsonObj['timestamp'] = initTimeStamp + time
        jsonObj['emotion'] = objs[0]['dominant_emotion']

        objs.append({'timestamp': time})
        print(jsonObj)
 
        return jsonObj
    except Exception as e: 
        print("Falhou em entender a foto: ", e)
        return jsonObj


#ImgQuant: número de frames
#DataQuant: intervalo de frames a serem analisados
def framesAnalyze(imgQuant, dataQuant, initTimeStamp):  
    objs = []
    dataName = 'ferdata/ferData.json'
    for i in range(1, imgQuant + 1, dataQuant):
        imgName = 'frames/frame' + str(i) + '.jpg'
        
        obj = faceAnalyze(imgName, i/(dataQuant/2), initTimeStamp)
        if obj != {}:
            objs.append(obj)

    with open(dataName, 'w') as f:
            json.dump(objs, f, indent=4)

    print(objs)
    return objs