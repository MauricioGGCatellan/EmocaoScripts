import { useState, useEffect } from 'react' 
import './App.css' 
import { Chart, type ReactGoogleChartEvent  } from "react-google-charts"; 
import {jsonToGantt} from "./converter.ts"; 
import type { EmoData, GanttTable } from './converter.ts';
import { fetchFerEmoData, fetchHrEmoData } from './datamanager.ts';
import {Select, InputLabel, MenuItem, FormControl} from '@mui/material';  
import type { SelectChangeEvent } from "@mui/material/Select";

//formato dos dados recebidos
//[timestamp, [emotions]]
 
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
    
    fetchFerEmoData().then((res) => {
      const ferEmoData = []
      ferEmoData.push(res)

      setJsonData(ferEmoData as EmoData[][]);
    });

  }, []);
  
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
         <Chart
            chartType="Gantt" 
            height="400px"
            width="100%"  
            options={optionsGantt}
            data={dataGantt} 
            loader={<div>Loading chart...</div>}
            chartEvents={chartEvents}   
         /> 
      </div>
    </div>
  )
}

export default App
