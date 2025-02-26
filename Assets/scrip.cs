using UnityEngine;
using UnityEngine.XR.ARFoundation;

   
public class scrip : MonoBehaviour
{
    public struct EyeInfo  {
        public string fixationPoint;
        public string leftEye;
        public string rightEye;
    }
    public System.IO.StreamWriter fileHandler; 
    public string dirPath;
    public string path; 

    void Start()
    {
        //Initializing fields
        dirPath = Application.persistentDataPath + "/" + "EyeLogs";
        path = Application.persistentDataPath + "/" + "EyeLogs" + "/" + "eyeTest.txt"; 
        fileHandler = new System.IO.StreamWriter(path);

        //Initializing face trackable
        var manager = Object.FindAnyObjectByType<ARFaceManager>();

        manager.trackablesChanged.AddListener(OnTrackablesChanged);
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    void OnDisable()
    {
        if(fileHandler != null) fileHandler.Close();
    }

    public void OnTrackablesChanged(ARTrackablesChangedEventArgs<ARFace> changes)
    { 
        foreach (var face in changes.added)
        {
            // handle added faces
        }

        foreach (ARFace face in changes.updated)
        {
            if(face == null) continue; 
            // handle updated faces                

            EyeInfo eyeInfo;
 
            //ENTENDER POR QUE OS DADOS SEMPRE VÊM NULOS!!!!!
            print("Indices: " + face.indices);
            print("Normals: " + face.normals);
            print("Uvs: " + face.uvs);
            print("Vertices: " + face.vertices);

            if(face.fixationPoint != null){
                print("Fixation Point!!!!!!!");
                //print(face.fixationPoint.localPosition); print(face.fixationPoint.localRotation);
                eyeInfo.fixationPoint = face.fixationPoint.localPosition.ToString() + "," + face.fixationPoint.localRotation.ToString() + "," + face.fixationPoint.localScale.ToString();
            } else{
                print("Sem dados para Fixation Point!");
                eyeInfo.fixationPoint = "";
            }
            
            if(face.leftEye != null){
                print("Left Eye!!!!!!!");
                //face.leftEye.GetPositionAndRotation(out pos, out rot);
                //Debug.Log(pos); Debug.Log(rot);
                eyeInfo.leftEye = face.leftEye.localPosition.ToString() + "," + face.leftEye.localRotation.ToString() + "," + face.leftEye.localScale.ToString();
            } else{
                print("Sem dados para Left Eye!");
                eyeInfo.leftEye = "";
            }

            if(face.rightEye != null){
                print("Right Eye!!!!!!!");
                //face.rightEye.GetPositionAndRotation(out pos, out rot);
                //Debug.Log(pos); Debug.Log(rot);
                eyeInfo.rightEye = face.rightEye.localPosition.ToString() + "," + face.rightEye.localRotation.ToString() + "," + face.rightEye.localScale.ToString();
            } else{
                print("Sem dados para Right Eye!"); 
                eyeInfo.rightEye = "";
            }
            //print(eyeInfo);

            // Saving to a file 
            if(face.fixationPoint != null && face.leftEye != null && face.rightEye != null){
                print("SALVANDO DADOS EM ARQUIVO!!!!");
                SaveToFile(eyeInfo);
            }
             
        }

        foreach (var face in changes.removed)
        {
            // handle removed faces
        }
    }

    private void SaveToFile(EyeInfo eyeInfo){

        string lines = eyeInfo.fixationPoint + "," + eyeInfo.leftEye + "," + eyeInfo.rightEye;
        
        if(!System.IO.Directory.Exists(dirPath)) System.IO.Directory.CreateDirectory(dirPath);
        if(!System.IO.File.Exists(path)) System.IO.File.Create(path);
 
        fileHandler.WriteLine(lines);
    }
 
}
