import type { Task } from "./components/GanttChart";

export interface EmoData {
  timestamp: number;
  emotion: string;
}
   
export function jsonToGantt(jsonData: EmoData[], verticalData: string[], timePerStep: number[]): Task[]{
    if(!jsonData || jsonData.length < 1 || !verticalData || verticalData.length < 1){
        return [];
    }

    const ganttData: Task[] = [];
 
    let previousEmotion = jsonData[0].emotion;
    let firstTimeStamp = jsonData[0].timestamp;  

    let timestep = 0;
  
    console.log(verticalData)
    const fullTimePerStep: number[] = [];
    let sum = 0;
    for(let i = 0; i < timePerStep.length; i++){ 
        sum = sum + timePerStep[i]

        fullTimePerStep.push(sum);
    } 
 
    //jsonData: diferentes pessoas
    for(const jsonList of jsonData){  
        if(!jsonList){
            continue;
        } 

        let timestamp = jsonList.timestamp;
        let emotion = jsonList.emotion;

        if(emotion === previousEmotion && !(firstTimeStamp < fullTimePerStep[timestep] && timestamp > fullTimePerStep[timestep])){
            continue;
        }

        //verifica breakpoint entre steps
        if(!(firstTimeStamp < fullTimePerStep[timestep] && timestamp > fullTimePerStep[timestep])){ 
            const newTask: Task = {
                startDate: new Date(firstTimeStamp*1e3),
                endDate: new Date(timestamp*1e3),
                taskName: verticalData[timestep],
                status: previousEmotion
            }

            ganttData.push(newTask);  
        } else{ 
            const newTaskPreStep: Task = {
                startDate: new Date(firstTimeStamp*1e3),
                endDate: new Date(timePerStep[timestep]*1e3),
                taskName: verticalData[timestep],
                status: previousEmotion
            }
            
            ganttData.push(newTaskPreStep);

            const newTaskPostStep: Task = {
                startDate: new Date(timePerStep[timestep]*1e3),
                endDate: new Date(timestamp*1e3),
                taskName: verticalData[timestep + 1],
                status: previousEmotion
            }

            ganttData.push(newTaskPostStep);

            timestep++;
        } 

        //atualiza
        previousEmotion = emotion;
        firstTimeStamp = timestamp;  
    }

    if( firstTimeStamp <  fullTimePerStep[timestep]){
        //salvar o final (última emoção medida) se ainda estiver dentro de um dos rows possíveis 
        const lastTask: Task = {
            startDate: new Date(firstTimeStamp*1e3),
            endDate: new Date(jsonData[jsonData.length - 1].timestamp*1e3),
            taskName: verticalData[verticalData.length - 1],
            status: previousEmotion
        }

        ganttData.push(lastTask);
    }
        
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

export function jsonToDuration(jsonData: EmoData[]){
    if(!jsonData || jsonData.length < 1){
        return 0;
    }
    
    const durationTimestamp = jsonData[jsonData.length - 1].timestamp - jsonData[0].timestamp

    return durationTimestamp
}