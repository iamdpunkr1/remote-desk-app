import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import { RoomProvider } from './context/RoomContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RoomProvider>
    <App />
  </RoomProvider>
);