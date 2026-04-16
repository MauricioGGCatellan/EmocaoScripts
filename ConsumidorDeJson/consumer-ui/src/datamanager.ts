import axios from 'axios';
import type { EmoData } from './converter';

export type APIResult = {
  res: EmoData[],
  err: string
};

export async function fetchFerEmoData(person: string, signal: AbortSignal){
    const videoName = 'video.mp4';

    try {
        const response = await axios.get<APIResult>(`http://127.0.0.1:8000/face/${videoName}/${person}`, {
            params: {
                videoName: videoName
            },
            signal: signal
        });

        if(response.data.err != ""){
            throw response.data.err;
        }

        const emosData = response.data.res; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    } 
}

export async function fetchHrEmoData(method:string, person: string, signal: AbortSignal){
    try {
        const response = await axios.get<APIResult>(`http://127.0.0.1:8000/hr/${method}/${person}`, {
            params: {
                method: method
            },
            signal: signal
        });

        if(response.data.err != ""){
            throw response.data.err;
        }

        const emosData = response.data.res; 

        console.log(emosData);

        return emosData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);
    }  
}

export async function fetchVerticalAxisData(token:string /*id:string*/){
    try {
        const query = `
            {
                node($id: {id}) {
                    ... on User Sessions {
                        Users { name }
                        Game { name }
                    }
                }
            }
            `;

        const verticalSource = 'http://localhost:8085/graphql'
        const response = await axios.post(verticalSource, {query}, {headers: {
            Authorization: "Bearer " + token
        }});

        const verticalData = response.data.data;     

        console.log(verticalData);

        return verticalData;

    } catch (error: any) {
        console.error('Error during fetching:', error.message);

        return ['Jogo']
    }
}

export async function fetchAllUsersData(token:string) {
    try{
        const query = `{
            getAllUsers{
                id
                name
            }
        }`;

        const verticalSource = 'http://localhost:8085/graphql'

        const response = await axios.post(verticalSource, {query}, {headers: {
            Authorization: "Bearer " + token
        }});

        const allUsers = response.data.data.getAllUsers;     

        console.log(allUsers);

        return allUsers;
    }
    catch (error: any) {
        console.error('Error during fetching:', error.message);

        return ['Eu']
    }
}