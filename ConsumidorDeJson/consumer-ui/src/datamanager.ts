import axios from 'axios';
import type { EmoData } from './converter';

export async function fetchFerEmoData(signal: AbortSignal){
    const videoName = 'video.mp4';

    try {
        const response = await axios.get<EmoData[]>(`http://127.0.0.1:8000/face/${videoName}`, {
            params: {
                videoName: videoName
            },
            signal: signal
        });

        const emosData = response.data; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    } 
}

export async function fetchHrEmoData(method:string, signal: AbortSignal){
    try {
        const response = await axios.get<EmoData[]>(`http://127.0.0.1:8000/hr/${method}`, {
            params: {
                method: method
            },
            signal: signal
        });

        const emosData = response.data; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    }  
}

export async function fetchVerticalAxisData(){
    try {
        const query = `
            query GetSessions {
                me {
                Sessions {
                    Users { name }
                    Game { name }
                }
                }
            }
            `;

        const verticalSource = 'http://localhost:8085/graphql'
        const response = await axios.post(verticalSource, {query});

        const verticalData = response.data.data;     

        console.log(verticalData);

        return verticalData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);

        return ['Jogo']
    }
}