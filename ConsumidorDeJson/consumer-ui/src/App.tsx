import { useState, useEffect } from 'react'; 
import './App.css';  
import {jsonToGantt, jsonToAllEmotions, jsonToDuration} from "./converter.ts"; 
import type { EmoData } from './converter.ts';
import { fetchFerEmoData, fetchHrEmoData, fetchVerticalAxisData } from './datamanager.ts';
import {Select, MenuItem, FormControl, CircularProgress, Box, Typography} from '@mui/material';  
import type { SelectChangeEvent } from "@mui/material/Select";
import { GanttChart } from './components/GanttChart.tsx';
import type {Task} from "./components/GanttChart.tsx"; 
declare const d3: any;

function App() {   
  const [ganttAllData, setGanttAllData] = useState<Task[]>([]) 
  const [jsonData, setJsonData] = useState<EmoData[]>([])
  const [verticalAxisData, setVerticalAxisData] = useState<string[]>([])

  const [dataGantt, setDataGantt] = useState(ganttAllData);
  const [allEmos, setAllEmos] = useState<any[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<number>(1);
  
  const [method, setMethod] = useState<string>("FER");

  const [loading, setLoading] = useState<boolean>(false);

  const [duration, setDuration] = useState<number>(0);
 
	const tableau10 = d3.scale.category10().range();
  console.log(tableau10)
  const boxStyle = {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between", 
        padding: "8px 12px",
        border: "1px solid " + "#4d4d4d",
        backgroundColor: "#dcdbdb",
        boxSizing: "border-box",
        height: "100%",
        borderRadius: "4px"
      }
  useEffect(() => {
  const controller = new AbortController();
  const signal = controller.signal;   

    setLoading(true);
    if(method == 'FER'){
      fetchFerEmoData(signal).then((res) => {
      const ferEmoData = res

      setJsonData(ferEmoData as EmoData[]);
      }).catch(err => {
        console.log(err)
      }).finally( () => {
        fetchVerticalAxisData().then((res) => {
          setVerticalAxisData(res as string[])
        }).catch(err => {console.log(err)})
          .finally(() => {
          setLoading(false); 
        }) 
      }
      );
    } else if(method == 'HR'){
      fetchHrEmoData('knn', signal).then((res) => {
        const hrEmoData = res

        setJsonData(hrEmoData as EmoData[])
      }).catch(err => {
        console.log(err)
      }).finally( () => {
        fetchVerticalAxisData().then((res) => {
          setVerticalAxisData(res as string[])
        }).catch(err => {console.log(err)})
          .finally(() => {
          setLoading(false); 
        }) 
      }
      );
    } else{
      setLoading(false);
      console.log("Unknown method inputted")
    }
 
    return () => {
      controller.abort();
    };
  }, [method]);
  
  useEffect(() => {
    setGanttAllData(jsonToGantt(jsonData, verticalAxisData)); 

    const allEmotions = jsonToAllEmotions(jsonData);
    console.log(allEmotions);

    setAllEmos(allEmotions);

    setDuration(jsonToDuration(jsonData))
  }, [jsonData, verticalAxisData])

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
        <Box sx={boxStyle}>  
          <Select 
            value={selectedPerson} 
            onChange={handleChange}
            sx={{height:"24px"}}
          >
            <MenuItem value={1}>Player 1</MenuItem>
            <MenuItem value={2}>Player 2</MenuItem>
            <MenuItem value={3}>Player 3</MenuItem>
          </Select>
          <Typography variant="body2">
            Jogador
          </Typography>
        </Box>

      </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>  
            <Select 
              value={method} 
              onChange={handleMethodChange}
              sx={{height:"24px"}}
            >
              <MenuItem value={"FER"}>FER</MenuItem>
              <MenuItem value={"HR"}>HR</MenuItem> 
            </Select>
            <Typography variant="body2">
              Método
          </Typography>
      </Box>
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography variant="body2">
          {duration==0 ? '--' : duration}s
        </Typography>
        <Typography variant="body2">
          Duração da partida
        </Typography>
      </Box> 
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography variant="body2">
          ----
        </Typography>
        <Typography variant="body2">
          Info extra 1
        </Typography>
      </Box>   
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography variant="body2">
          ----
        </Typography>
        <Typography variant="body2">
          Info extra 2
        </Typography>
      </Box>   
    </FormControl>
    </aside>
      <div className="gantt-chart">
         {
         loading? (
          <div className="loading-container">
            <CircularProgress/>
          </div>
         )  : <div/>
        }
        
          <GanttChart tasks={dataGantt} taskNames={verticalAxisData} taskStatus={allEmos}/>

          {!loading && <Box
            sx={{
              position: "absolute",
              top: 416,
              right: 64,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "6px",
              padding: "8px 12px",
              boxShadow: 3,
              zIndex: 10,
              minWidth: "140px"
            }}
          >
    <Typography variant="subtitle2">Legenda</Typography>

      {Object.entries(allEmos).map(([emo, _], i) => (
        <Box
          key={emo}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              backgroundColor: tableau10[i]
            }}
          />
          <Typography variant="caption">{emo}</Typography>
        </Box>
      ))}
    </Box>}  

      </div>
    </div>
  )
}

export default App
