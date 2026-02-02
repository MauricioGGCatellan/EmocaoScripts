import axios from 'axios';
import type { EmoData } from './converter';

export async function fetchFerEmoData(){
    const videoName = 'lalala';

    try {
        const response = await axios.get<EmoData[]>(`https://localhost:5000/face/{videoName}`, {
            params: {
                videoName: videoName
            }
        });

        const emosData = response.data; 

        console.log(emosData);

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    } 
}

export async function fetchHrEmoData(method:string){
    try {
        const response = await axios.get<EmoData[]>(`https://localhost:5000//hr/{method}`, {
            params: {
                method: method
            }
        });

        const emosData = response.data; 

        console.log(emosData);

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    }  
}