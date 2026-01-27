import { useState, useEffect } from 'react' 
import './App.css' 
import { Chart, type ReactGoogleChartEvent  } from "react-google-charts"; 
import {jsonToGantt} from "./converter.ts";

//formato dos dados recebidos
//[timestamp, [emotions]]
 
//Timestamp em segundos
const jsonData = [[
    {
        "timestamp": 1746368750,
        "emotion": "fear"
    },
    {
        "timestamp": 1746368778,
        "emotion": "neutral"
    },
    {
        "timestamp": 1746368779,
        "emotion": "neutral"
    },
    {
        "timestamp": 1746368780,
        "emotion": "neutral"
    },
    {
        "timestamp": 1746368840,
        "emotion": "angry"
    },
    {
        "timestamp": 1746368841,
        "emotion": "angry"
    },],
     [
    {
        "timestamp": 1746368776,
        "emotion": "sad"
    },
    {
        "timestamp": 1746368778,
        "emotion": "surprised"
    },
    {
        "timestamp": 1746368779,
        "emotion": "surprised"
    },
    {
        "timestamp": 1746368780,
        "emotion": "surprised"
    },
    {
        "timestamp": 1746368840,
        "emotion": "angry"
    },
    {
        "timestamp": 1746368866,
        "emotion": "angry"
    },],
    [
    {
        "timestamp": 1746368776,
        "emotion": "happy"
    },
    {
        "timestamp": 1746368778,
        "emotion": "fear"
    },
    {
        "timestamp": 1746368779,
        "emotion": "fear"
    },
    {
        "timestamp": 1746368780,
        "emotion": "fear"
    },
    {
        "timestamp": 1746368840,
        "emotion": "angry"
    },
    {
        "timestamp": 1746368849,
        "emotion": "angry"
    },]];

const ganttData = jsonToGantt(jsonData);

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

    const [dataGantt, setDataGantt] = useState(ganttData[0]);
  
  const [selectedPerson, setSelectedPerson] = useState(1);
  
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
    //mudar dados
    console.log(selectedPerson);
    setDataGantt(ganttData[selectedPerson - 1]);
  }, [selectedPerson])

  return (
    <div className="gantt-container">
     <aside className="gantt-menu">
      <h4>Menu</h4>

      <button onClick={() => {if(selectedPerson != 1) setSelectedPerson(1)} }>Player 1</button>
      <button onClick={() => {if(selectedPerson != 2) setSelectedPerson(2)} }>Player 2</button>
      <button onClick={() => {if(selectedPerson != 3) setSelectedPerson(3)} }>Player 3</button>
 
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
