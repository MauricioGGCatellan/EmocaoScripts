import { useState, useEffect } from 'react'; 
import './App.css';  
import {jsonToGantt, jsonToAllEmotions} from "./converter.ts"; 
import type { EmoData } from './converter.ts';
import { fetchFerEmoData, fetchHrEmoData } from './datamanager.ts';
import {Select, InputLabel, MenuItem, FormControl} from '@mui/material';  
import type { SelectChangeEvent } from "@mui/material/Select";
import { GanttChart } from './components/GanttChart.tsx';
import type {Task} from "./components/GanttChart.tsx";

//formato dos dados recebidos
//[timestamp, [emotions]] 
/*
const tasksTestD3 = [ 
{ 
    startDate: new Date(2026, 2, 11, 1, 36, 45),
    endDate: new Date(2026, 2, 11, 2, 36, 45),
    taskName: "C1",
    status: "FAILED"
}, 
{
    startDate: new Date(2026, 2, 11, 4, 56, 32),
    endDate: new Date(2026, 2, 11, 6, 35, 47),
    taskName: "C2",
    status: "RUNNING"
}]; 
*/

//não sei de onde virá ainda
const taskNamesTestD3 = [ "C1", "C2"];
  
function App() {   
  const [ganttAllData, setGanttAllData] = useState<Task[]>([]) 
  const [jsonData, setJsonData] = useState<EmoData[]>([])

  const [dataGantt, setDataGantt] = useState(ganttAllData);
  const [allEmos, setAllEmos] = useState<any[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<number>(1);
  
  const [method, setMethod] = useState<string>("FER");
  
  useEffect(() => {
    if(method == 'FER'){
      fetchFerEmoData().then((res) => {
      const ferEmoData = res

      setJsonData(ferEmoData as EmoData[]);
      });
    } else if(method == 'HR'){
      fetchHrEmoData('KNN').then((res) => {
        const hrEmoData = res

        setJsonData(hrEmoData as EmoData[])
      });
    } else{
      console.log("Unknown method inputted")
    }

  }, [method]);
  
  useEffect(() => {
    setGanttAllData(jsonToGantt(jsonData)); 

    const allEmotions = jsonToAllEmotions(jsonData);
    console.log(allEmotions);

    setAllEmos(allEmotions);
  }, [jsonData])

  useEffect(() => {
    //mudar dados
    console.log(selectedPerson);
    
    if(!ganttAllData[selectedPerson-1]){
      return;
    }
    
    //ARRUMAR PARA INCLUIR PESSOAS DEPOIS
    setDataGantt(ganttAllData);
  }, [selectedPerson, ganttAllData])

  const handleChange = (event: SelectChangeEvent<number>) => {
    setSelectedPerson(Number(event.target.value));
  };

  const handleMethodChange = (event: SelectChangeEvent<string>) => {
    setMethod(event.target.value);
  };

  return (
    <div className="gantt-container">
      <aside className="gantt-menu">
      <FormControl fullWidth size="small">
        <InputLabel id="player-select-label">Player</InputLabel>

        <Select
          labelId="player-select-label"
          value={selectedPerson}
          label="Player"
          onChange={handleChange}
        >
          <MenuItem value={1}>Player 1</MenuItem>
          <MenuItem value={2}>Player 2</MenuItem>
          <MenuItem value={3}>Player 3</MenuItem>
        </Select>

      </FormControl>
    <FormControl fullWidth size="small">
    <InputLabel id="method-select-label">Method</InputLabel> 
        <Select
          labelId="method-select-label"
          value={method}
          label="Method"
          onChange={handleMethodChange}
        >
          <MenuItem value={"FER"}>FER</MenuItem>
          <MenuItem value={"HR"}>HR</MenuItem> 
        </Select>
    </FormControl>
    </aside>
      <div className="gantt-chart">
         <GanttChart tasks={dataGantt} taskNames={taskNamesTestD3} taskStatus={allEmos}/>
      </div>
    </div>
  )
}

export default App
