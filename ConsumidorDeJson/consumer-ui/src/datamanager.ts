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