
export interface EmoData {
  timestamp: number;
  emotion: string;
}

type GanttColumn =
  | { type: "string"; label: "Task ID" }
  | { type: "string"; label: "Task Name" }
  | { type: "string"; label: "Resource" }
  | { type: "date"; label: "Start Date" }
  | { type: "date"; label: "End Date" }
  | { type: "number"; label: "Duration" }
  | { type: "number"; label: "Percent Complete" }
  | { type: "string"; label: "Dependencies" };

type GanttRow = [
  string,           // Task ID
  string,           // Task Name
  string,           // Resource
  Date,             // Start Date
  Date,             // End Date
  number | null,    // Duration
  number | null,    // Percent Complete
  string | null     // Dependencies
];

type GanttTable = [GanttColumn[], ...GanttRow[]];
 
export function jsonToGantt(jsonData: EmoData[][]){

    let ganttData: GanttTable[] = [];

    let id = "1";

    //jsonData: diferentes pessoas
    for(const jsonList of jsonData){
        let ganttIndex = ganttData.push([[
            { type: "string", label: "Task ID" },
            { type: "string", label: "Task Name" }, 
            { type: "string", label: "Resource"},
            { type: "date", label: "Start Date" },
            { type: "date", label: "End Date" },
            { type: "number", label: "Duration" },
            { type: "number", label: "Percent Complete" },
            { type: "string", label: "Dependencies" },
            ],]) - 1;

        let previousEmotion = jsonList[0].emotion;
        let firstTimeStamp = jsonList[0].timestamp;

        for(const jsonOne of jsonList){
            let timestamp = jsonOne.timestamp;
            let emotion = jsonOne.emotion;

            if(emotion === previousEmotion){
                continue;
            }
            
            //Pensar em como trazer a cena
            ganttData[ganttIndex].push([id, "C1", previousEmotion, new Date(firstTimeStamp*1e3), new Date(timestamp*1e3), null, null, null])
            
            //atualiza
            previousEmotion = emotion;
            firstTimeStamp = timestamp; 
            id = id + 1;
        }

        //salvar o final (última emoção medida)
        ganttData[ganttIndex].push([id, "C1", previousEmotion, new Date(firstTimeStamp*1e3), new Date(jsonList[jsonList.length - 1].timestamp*1e3), null, null, null])
    }
 
    return ganttData 
}