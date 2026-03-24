
import type { Task } from "./components/GanttChart";

export interface EmoData {
  timestamp: number;
  emotion: string;
}
 
export function jsonToGantt(jsonData: EmoData[], verticalData: string[]): any[]{
    if(!jsonData || jsonData.length < 1 || !verticalData || verticalData.length < 1){
        return [];
    }

    const ganttData: Task[] = [];

    let previousEmotion = jsonData[0].emotion;
    let firstTimeStamp = jsonData[0].timestamp;
    //jsonData: diferentes pessoas
    for(const jsonList of jsonData){ 

        if(!jsonList){
            continue;
        } 

        let timestamp = jsonList.timestamp;
        let emotion = jsonList.emotion;

        if(emotion === previousEmotion){
            continue;
        }
            
        //Pensar em como trazer a cena 
        const newTask: Task = {
            startDate: new Date(firstTimeStamp*1e3),
            endDate: new Date(timestamp*1e3),
            taskName: verticalData[0],
            status: previousEmotion
        }

            ganttData.push(newTask);
  
            //atualiza
            previousEmotion = emotion;
            firstTimeStamp = timestamp;  
    }

        //salvar o final (última emoção medida) 
    const lastTask: Task = {
        startDate: new Date(firstTimeStamp*1e3),
        endDate: new Date(jsonData[jsonData.length - 1].timestamp*1e3),
        taskName: verticalData[0],
        status: previousEmotion
    }

    ganttData.push(lastTask);
        
    return ganttData 
}

export function jsonToAllEmotions(jsonData: EmoData[]): string[]{
    if(!jsonData || jsonData.length < 1){
        return [];
    }

    const allEmosStyles: any = [];
    const allEmos: string[] = [];
    const styleStr = "bar-";

    for(const jsonOne of jsonData){
        if(allEmos.some((emo) =>{
            return emo === jsonOne.emotion;        
        })){
            continue;
        }

        allEmos.push(jsonOne.emotion);
        allEmosStyles[jsonOne.emotion] = styleStr + allEmos.length
    }
     
    return allEmosStyles;
}