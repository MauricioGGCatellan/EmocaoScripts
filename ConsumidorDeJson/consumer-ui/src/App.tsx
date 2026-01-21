import { useState, useEffect } from 'react' 
import './App.css' 
import { Chart, type ReactGoogleChartEvent  } from "react-google-charts"; 

//formato dos dados recebidos
//[timestamp, [emotions]]

//Usar consumer para obter data
/*const dataHistogram = [
  ["Emotion", "Percentage"],
  ["Anger", 12.2],
  ["Happiness", 9.1],
  ["Sadness", 12.2],
  ["Surprise", 22.9],
  ["Fear", 0.9],
];*/

 
/*const optionsHistogram = {
  title: "Emotions in percentage during experiment",
  legend: { position: "none" },
};*/

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

    const [dataGantt, setDataGantt] = useState([
    [
      { type: "string", label: "Task ID" },
      { type: "string", label: "Task Name" }, 
      {type: "string", label: "Resource"},
      { type: "date", label: "Start Date" },
      { type: "date", label: "End Date" },
      { type: "number", label: "Duration" },
      { type: "number", label: "Percent Complete" },
      { type: "string", label: "Dependencies" },
    ],
    [
      "Id1",
      "C1", 
      "Happy", //data[0][n] (bigger %)
      new Date(2015, 0, 9),    //startDate  data[0][0]
      new Date(2015, 0, 9, 0, 30), //startDate + timestamp, timestap = data[n][0]
      null,
      25,
      null,
    ],
    [
      "Id2",
      "C2", 
      "Sad",
      new Date(2015, 0, 9, 0, 30),
      new Date(2015, 0, 9, 0, 45),
      null,
      25,
      null,
    ],
    [
      "Id3",
      "C3", 
      "Suprised",
      new Date(2015, 0, 9, 0, 45),
      new Date(2015, 0, 9, 1, 0),
      null,
      25,
      null,
    ],
  ]);
  
 
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
  

  return (
    <div className="gantt-container">
     <aside className="gantt-menu">
      <h4>Menu</h4>

      <button onClick={() => {} }>Player 1</button>
      <button onClick={() => {} }>Player 2</button>
      <button onClick={() => {} }>Player 3</button>
 
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
