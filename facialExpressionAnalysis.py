from deepface import DeepFace 

import json 
import pandas

#Real time a ser usado depois na prática:
#DeepFace.stream(db_path = "/mnt/c/database")           #Acho que já tenho que ter o db criado de antemão

def faceAnalyze(imgName, initTimeStamp):
    jsonObj = {}
    try:
        objs = DeepFace.analyze(
            img_path = imgName, 
            actions = ['emotion'],
            #model_name = "Facenet"
        ) 
        
        #time é um marcador de timestamp com referencial no próprio vídeo
        jsonObj['timestamp'] = initTimeStamp 
        jsonObj['dominant_emotion'] = objs[0]['dominant_emotion']
        jsonObj['emotions'] = objs[0]['emotion']
 
        print(jsonObj)
 
        return jsonObj
    except Exception as e: 
        print("Falhou em entender a foto: ", e)
        return jsonObj


#ImgQuant: número de frames
#DataQuant: intervalo de frames a serem analisados
def framesAnalyze(user, imgQuant, fps, initTimeStamp):  
    objs = []
    dataName = 'ferdata/' + user + '_ferData.json'
    for i in range(0, imgQuant, fps):
        imgName = f'frames_{user}/frame{i}.jpg'
        
        obj = faceAnalyze(imgName, initTimeStamp + i)
        if obj != {}:
            objs.append(obj)

    #janela temporal
    #Talvez parametrizar a janela!
    df = pandas.DataFrame(objs)

    emotions_df = pandas.json_normalize(df['emotions'])
    df_rolling = emotions_df.rolling(2).mean() 
    #df_rolling = df_rolling.dropna()

    df['mean_emotions'] = df_rolling.to_dict(orient='records')
    df['emotion'] = df_rolling.idxmax(axis = 1)
    df = df.dropna()

    #Remover coluna emotions?
    df = df.drop(columns=['mean_emotions','dominant_emotion', 'emotions'], axis=1)
    res = df.to_dict(orient='records')

    print("APOS JANELA:", res)
    with open(dataName, 'w') as f:
            json.dump(res, f, indent=4)

    print("ANTES DA JANELA:", objs)
    return res