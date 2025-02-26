using UnityEngine;
using UnityEngine.XR.ARFoundation;

public class installation : MonoBehaviour
{
    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        //if(ARSession.state == ARSessionState.NeedsInstall){
        ARSession.Install();
        //}
        //else{
        //    print("Instalacao nao efetuada.");
        //}
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
