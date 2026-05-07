//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root') as HTMLElement).render( 
  //<StrictMode>
    <App sessionId='U2Vzc2lvbjplODllNDcyNC00MWZkLTQ5YmMtYjkwNy02ZmQxNWUwOWUwYzY=' token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0ODRlM2Q1Yi00ODY3LTRlZTMtODM5MC1kZDdkMjMwOGY0Y2MiLCJpYXQiOjE3NzcwMzg1NDl9.TFTBq0J3G73DvPAKEaZHYvnPcYQfWtKQrCW1w5Lhz4c'/>
  //</StrictMode>,
)
 