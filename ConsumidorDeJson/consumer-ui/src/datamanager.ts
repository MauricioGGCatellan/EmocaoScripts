import axios from 'axios';
import type { EmoData } from './converter';

export async function fetchFerEmoData(){
    const videoName = 'lalala';

    try {
        const response = await axios.get<EmoData[]>(`http://127.0.0.1:8000/face/${videoName}`, {
            params: {
                videoName: videoName
            }
        });

        const emosData = response.data; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    } 
}

export async function fetchHrEmoData(method:string){
    try {
        const response = await axios.get<EmoData[]>(`http://127.0.0.1:8000/hr/${method}`, {
            params: {
                method: method
            }
        });

        const emosData = response.data; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    }  
}

//Timestamp em segundos
/*
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
*/