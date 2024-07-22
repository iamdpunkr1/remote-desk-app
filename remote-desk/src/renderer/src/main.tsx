import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import { RoomProvider } from './context/RoomContext';
import Rtc from './Rtc';

const useSocket:boolean = false; 

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RoomProvider>
    { useSocket? <App /> : <Rtc/> }
  </RoomProvider>
);