import axios from 'axios'; 
import type { APIResult, Content } from './apityping';

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


export async function fetchVerticalAxisData(sessionId: string, token:string){ 
    const possibleColumns = ["levels", "Levels", "Scenes", "scenes", "questions", "Questions", "SpeechBubbles", "speechbubbles"];

    try {
        const query = `
            {
            node(id: "${sessionId}"){
                ... on Session{
                Game{
                    ... on ComputationalThinking{
                    name
                    levels{
                        content
                    }
                    }
                    ... on Storytelling{
                    name
                    Scenes{
                    content
                    }
                    }
                    ... on Quiz{
                    name
                    Questions{
                        content
                    }
                    }
                    ... on Platform{
                    name
                    }
                    ... on ReverseStorytelling{
                    name
                    SpeechBubbles{
                        content
                    }
                    }
                    ... on Match{
                    name
                    }
                }
                }
            }
            }
            `;

        const verticalSource = 'http://localhost:8085/graphql'
        const response = await axios.post(verticalSource, {query}, {headers: {
            Authorization: "Bearer " + token
        }});

        const verticalData = response.data.data.node;     

        console.log(verticalData);
        //CHECAR SE BATE COM OS TIPOS!!!!!!!!!!!!!
        //Mudar dps para varios games (talvez)
        const game = verticalData.Game[0];
        //iterar possibleColumns para bater com game (in operator)
        for(let column of possibleColumns){
            if(column in game){
 
                const res = game[column].map((c: Content) => c.content);

                return res;
            }
        }
        return ['Jogo'];
  
    } catch (error: any) {
        console.error('Error during fetching:', error.message);

        return ['Jogo']
    }
}

export async function fetchAllUsersData(sessionId:string, token:string) {
    try{
        const query = `{
            node(id: "${sessionId}"){
                ... on Session{
                    Users{
                        id
                        name
                    }
                }
            }
        }`;

        const verticalSource = 'http://localhost:8085/graphql'
 
        const response = await axios.post(verticalSource, {query}, {headers: {
            Authorization: "Bearer " + token
        }});

        const allUsers = response.data.data.node.Users;     
  
        return allUsers;
    }
    catch (error: any) {
        console.error('Error during fetching:', error.message);

        return [];
    }
}

export async function auth(){ 
        const verticalSource = "https://www.googleapis.com/auth/fitness.heart_rate.read"

        const response = await axios.post(verticalSource, {}, {headers: {
            Authorization: "Bearer "
        }});

        const allUsers = response.data.data.getAllUsers;     

        console.log(allUsers);

        return allUsers;
}