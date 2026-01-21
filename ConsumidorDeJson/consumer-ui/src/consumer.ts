/*import * as promptSync from '../prompt-sync';

const prompt = promptSync();


function consumeFer(rcvJson:any){
    //Checar estrutura do json
    let timestamp = rcvJson['timestamp']
    let emotion: String = rcvJson['emotion']
    
    //retorna objeto com as infos
    return {timestamp, emotion}
}

function consumeHr(rcvJson:any){
    //Checar estrutura do json
    let timestamp = rcvJson['timstamp']

    let emotions = { 
        angry: rcvJson['emotion']['angry'],
        disgust: rcvJson['emotion']['disgust'],
        fear: rcvJson['emotion']['fear'],
        happy: rcvJson['emotion']['happy'],
        sad: rcvJson['emotion']['sad'],
        surprise: rcvJson['emotion']['surprise'],
        neutral: rcvJson['emotion']['neutral']
    }
    
    //retorna objeto com as infos
    return {timestamp, emotions}
    
}


console.log("aalalala");


//Usa objeto em UI
*/