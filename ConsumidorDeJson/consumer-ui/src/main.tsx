//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root') as HTMLElement).render( 
  //<StrictMode>
    <App sessionId='aaa' token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0ODRlM2Q1Yi00ODY3LTRlZTMtODM5MC1kZDdkMjMwOGY0Y2MiLCJpYXQiOjE3NzYyNzI5NDR9.Ayp3YfRLKMVsWriVFTTyjISBMA2Jq8nhIPIhysm0Tkg'/>
  //</StrictMode>,
)
 