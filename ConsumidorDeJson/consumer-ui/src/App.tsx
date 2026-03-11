import { useState, useEffect } from 'react' 
import './App.css' 
import { Chart, type ReactGoogleChartEvent  } from "react-google-charts"; 
import {jsonToGantt} from "./converter.ts"; 
import type { EmoData, GanttTable } from './converter.ts';
import { fetchFerEmoData, fetchHrEmoData } from './datamanager.ts';
import {Select, InputLabel, MenuItem, FormControl} from '@mui/material';  
import type { SelectChangeEvent } from "@mui/material/Select";
import { GanttChart } from './components/GanttChart.tsx';

//formato dos dados recebidos
//[timestamp, [emotions]] 

/*
const optionsGantt = {
  height: 400,
  gantt: {
    trackHeight: 30,
    innerGridHorizLine: {
      stroke: '#17BED0'
    },  
  },
  backgroundColor:{
    fill: 'white'
  }
};
*/
const tasksTestD3 = [ 
{ 
    startDate: new Date(2026, 2, 9, 1, 36, 45),
    endDate: new Date(2026, 2, 9, 2, 36, 45),
    taskName: "C1",
    status: "FAILED"
}, 
{
    startDate: new Date(2026, 2, 9, 4, 56, 32),
    endDate: new Date(2026, 2, 9, 6, 35, 47),
    taskName: "C2",
    status: "RUNNING"
}]; 

const taskNamesTestD3 = [ "C1", "C2"];
const taskStatusTestD3 = { 
    "SUCCEEDED": "bar",
    "FAILED": "bar-failed",
    "RUNNING": "bar-running",
    "KILLED": "bar-killed"
};
  
function App() {   
  const [ganttAllData, setGanttAllData] = useState<GanttTable[]>([]) 
  const [jsonData, setJsonData] = useState<EmoData[][]>([[]])

  const [dataGantt, setDataGantt] = useState(ganttAllData[0]);
  
  const [selectedPerson, setSelectedPerson] = useState<number>(1);
  
  const [method, setMethod] = useState<string>("FER");

  const chartEvents: ReactGoogleChartEvent[] = [ 
  {
    eventName: "ready",
    callback({ chartWrapper }) {
      if(chartWrapper != null){ 
        console.log("Chart ready. ", chartWrapper.getChart());
      }
      else{
        console.log("Chart not ready.");
      }
    },
  }, 
  ];

  useEffect(() => { 
    const w = window as any;
    
    // força inicialização global
    w.google?.charts?.load("current", { packages: ["gantt"] });
    w.google?.charts?.setOnLoadCallback(() => { 
    });
      
  }, []);

  useEffect(() => {
    if(method == 'FER'){
      fetchFerEmoData().then((res) => {
      const ferEmoData = []
      ferEmoData.push(res)

      setJsonData(ferEmoData as EmoData[][]);
      });
    } else if(method == 'HR'){
      fetchHrEmoData('KNN').then((res) => {
        const hrEmoData = []
        hrEmoData.push(res)

        setJsonData(hrEmoData as EmoData[][])
      });
    } else{
      console.log("Unknown method inputted")
    }

  }, [method]);
  
  useEffect(() => {
    setGanttAllData(jsonToGantt(jsonData)); 
  }, [jsonData])

  useEffect(() => {
    //mudar dados
    console.log(selectedPerson);
    
    if(!ganttAllData[selectedPerson-1]){
      return;
    }
    
    setDataGantt(ganttAllData[selectedPerson - 1]);
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
         <GanttChart tasks={tasksTestD3} taskNames={taskNamesTestD3} taskStatus={taskStatusTestD3}/>
      </div>
    </div>
  )
}

export default App
