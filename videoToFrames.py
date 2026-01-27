import cv2

#Alterar videoName conforme nome do vídeo

#videoName = '2025-06-26 11-19-28.mkv'

def videoToFrames(videoName):

  vidcap = cv2.VideoCapture(videoName)
  success,image = vidcap.read()
  count = 0
  
  while success:
    cv2.imwrite("frames/frame%d.jpg" % count, image)     # save frame as JPEG file      
    success,image = vidcap.read()
    print('Read a new frame: ', success)
    count += 1
  
  return count

 