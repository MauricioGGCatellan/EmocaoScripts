import { useState, useEffect } from 'react'; 
import './App.css';  
import {jsonToGantt, jsonToAllEmotions, jsonToDuration} from "./converter.ts"; 
import type { EmoData } from './converter.ts';
import { fetchAllUsersData, fetchFerEmoData, fetchHrEmoData, fetchVerticalAxisData } from './datamanager.ts';
import {Select, MenuItem, FormControl, CircularProgress, Box, Typography, ToggleButtonGroup, ToggleButton} from '@mui/material';  
import type { SelectChangeEvent } from "@mui/material/Select";
import { GanttChart } from './components/GanttChart.tsx';
import type {Task} from "./components/GanttChart.tsx"; 
import { emotionTranslations } from './translation.ts';

declare const d3: any;


type AppProps = {
  sessionId: string;
  token: string;
}

type User = {
  id: string;
  name: string;
}
 
function App({sessionId, token}: AppProps) {   
  const [ganttAllData, setGanttAllData] = useState<Task[]>([]) 
  const [jsonData, setJsonData] = useState<EmoData[]>([])
  const [verticalAxisData, setVerticalAxisData] = useState<string[]>([])

  const [dataGantt, setDataGantt] = useState(ganttAllData);
  const [allEmos, setAllEmos] = useState<string[]>([]);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<string>("");
  
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
        width: "100%",
        borderRadius: "4px"
      }

  const [viewMode, setViewMode] = useState<"A" | "B">("B");

  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: "A" | "B" | null
  ) => {
    if (newValue !== null) {
      setViewMode(newValue);
    }
  };

  useEffect(() => {
    fetchAllUsersData(sessionId, token).then((res) => { 
      setAllUsers(res);
      if(res.length > 0){
        setSelectedPerson(res[0].id);
      }
    }).catch(err => {
      console.log("Erro: " + err)
    }); 
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;   

    setLoading(true);
    if(method == 'FER'){
      fetchFerEmoData(selectedPerson, signal).then((res) => {
      const ferEmoData = res

      setJsonData(ferEmoData as EmoData[]);
      }).catch(err => {
        console.log(err)
      }).finally( () => {
        fetchVerticalAxisData(sessionId, token).then((res) => {
          setVerticalAxisData(res as string[])
        }).catch(err => {console.log(err)})
          .finally(() => {
          setLoading(false); 
        }) 
      }
      );
    } else if(method == 'HR'){
      fetchHrEmoData('knn', selectedPerson, signal).then((res) => {
        const hrEmoData = res

        setJsonData(hrEmoData as EmoData[])
      }).catch(err => {
        console.log(err)
      }).finally( () => {
        fetchVerticalAxisData(sessionId, token).then((res) => {
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
  }, [selectedPerson, method]);
  
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
    
    //chamar gantAllData da PESSOA
    //...
    ///


    if(!ganttAllData){
      return;
    }
    
    //ARRUMAR PARA INCLUIR PESSOAS DEPOIS
    setDataGantt(ganttAllData);
  }, [selectedPerson, ganttAllData])

  const handleChange = (event: SelectChangeEvent<string>) => {
    setSelectedPerson(event.target.value);
  };

  const handleMethodChange = (event: SelectChangeEvent<string>) => {
    setMethod(event.target.value);
  };

  return (
    <div className="gantt-container">
      <aside className="gantt-menu">

      <FormControl fullWidth size="small"  sx={{ gridColumn: "1 / -1" }}> 
        <Box
          sx={{display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",  
          boxSizing: "border-box",
          height: "100%",
          width: "100%"}}
        >
        <ToggleButtonGroup 
          value={viewMode}
          exclusive 
          onChange={handleViewChange}
          size="small"
          sx = {{
            display: 'flex', 
            width: "100%",
            height: "100%",
            border: "1px solid " + "#4d4d4d", 
            borderRadius: "4px",
            backgroundColor: "#dcdbdb", 
            boxSizing: "border-box",
            whiteSpace: "nowrap",
            overflow: "hidden"
          }}
        >
          <ToggleButton value="A" sx={{flex: 1, textTransform:"none", color:"text.primary", width:"100%", minWidth: "0"}}>
            <Typography noWrap variant="body2">
            Visão Geral
            </Typography>
          </ToggleButton>

          <ToggleButton value="B" sx={{flex: 1, textTransform:"none", color:"text.primary", width:"100%", minWidth: "0"}}>
            <Typography noWrap variant="body2">
            Visão Individual
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
        </Box>
      </FormControl>

      <FormControl fullWidth size="small">
        <Box sx={boxStyle}>  
          <Select 
            value={selectedPerson} 
            onChange={handleChange}
            sx={{height:"24px"}}
          > 
            {allUsers.map((user) => (
            <MenuItem value={user.id}>
              {user.name}
            </MenuItem>
            ))} 
          </Select>
          <Typography noWrap variant="body2">
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
              renderValue={(selected) => (
                <Box sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {selected}
                </Box>
              )}
            >
              <MenuItem sx={{ whiteSpace: "nowrap" }} value={"FER"}>FER</MenuItem>
              <MenuItem sx={{ whiteSpace: "nowrap" }} value={"HR"}>HR</MenuItem> 
            </Select>
            <Typography noWrap variant="body2">
              Método
          </Typography>
      </Box>
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography noWrap variant="body2">
          {duration==0 ? '--' : duration}s
        </Typography>
        <Typography noWrap variant="body2">
          Duração da partida
        </Typography>
      </Box> 
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography noWrap variant="body2">
          ----
        </Typography>
        <Typography noWrap variant="body2">
          Info extra 1
        </Typography>
      </Box>   
    </FormControl>
    <FormControl fullWidth size="small">
      <Box sx={boxStyle}>
        <Typography noWrap variant="body2">
          ----
        </Typography>
        <Typography noWrap variant="body2">
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
          <Typography variant="caption">{emotionTranslations[emo] || emo}</Typography>
        </Box>
      ))}
    </Box>}  

      </div>
    </div>
  )
}

export default App
