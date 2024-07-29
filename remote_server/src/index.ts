import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import { configDotenv } from 'dotenv';
import s from "connect-redis";


configDotenv({
    path: "./.env"
});

const PORT = 5008;
const allowedOrigins = ["https://remote-desk-web.vercel.app", "http://localhost:5173"];
const app: Application = express();

const logs: string[] = [];

function addLog(message: string) {
    const timestamp = new Date().toISOString();
    const log = `${timestamp} - ${message}`;
    logs.push(log);
    console.log(log);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

app.get("/", (req, res) => {
  const ipAddress = req.header('x-forwarded-for') || req.socket.remoteAddress || req.ip;
  addLog(`IP Address: ${ipAddress}`);
  return res.status(200).json({ message: "Welcome to Remote-Desk server" });
});

app.get('/view', (req, res) => {
  res.sendFile(__dirname + '/display.html');
});

app.get('/logs', (req: Request, res: Response) => {
  res.status(200).json({ logs });
});

const room = new Map();

const server: HTTPServer = createServer(app);
const io: SocketIOServer = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    // credentials: true
  }
});



io.on('connection', (socket: Socket) => {
  addLog('USER Connection established');

  socket.on("electron-app", (data) => {
    addLog(`Electron App text: ${data}`);
  });

  socket.on("join-room", (roomId, id="") => {
    if(room.has(roomId)) {
      addLog(`Second user to room: ${roomId}`);  
      // socket.emit('room-exists', roomId);
      const socketId = room.get(roomId);
      if(id === socketId){
        addLog('id matched');
         socket.join(roomId);
         io.to(socketId).emit('get-offer', roomId);
        }
    }else{
      socket.join(roomId);
      room.set(roomId, socket.id);
      addLog(`User joined in a room: ${roomId}`);
    }
    // socket.broadcast.to(roomId).emit('user-joined', roomId);
  });

  socket.on("request-screen-share", (roomId,hostname) => {
    addLog(`Screen share requested for room: ${roomId}, hostname: ${hostname}`);
    if(room.has(roomId)) {
      // socket.join(roomId);
      const socketId = room.get(roomId);
      socket.to(socketId).emit('screen-share-request', socket.id, hostname);
    }else{
      addLog(`Room not found: ${roomId}`);
      socket.emit('room-not-found', roomId);
    }
    
  });

  socket.on("screen-share-response", (roomId, accepted, requesterId) => {
    if (accepted) {
      addLog(`Screen share accepted for room: ${roomId}`);
      io.to(requesterId).emit('screen-share-accepted', roomId, socket.id);
    } else {
      addLog(`Screen share denied for room: ${roomId}`);
      io.to(requesterId).emit('screen-share-denied', roomId);
    }
  });

  socket.on("screen-data", function(data) {
    data = JSON.parse(data);
    var room = data.room;
    var imgStr = data.image;
    socket.broadcast.to(room).emit('screen-data', imgStr);
    addLog(`Screen data received for room: ${room}`);
  });

  socket.on('offer', (sdp, roomId) => {
    // socket.join(roomId);
    addLog('Routing offer: '+roomId);
    socket.broadcast.to(roomId).emit('offer', sdp, roomId);
  });

  socket.on('answer', (sdp, roomId) => {
    addLog('Routing answer: '+roomId);
    socket.broadcast.to(roomId).emit('answer', sdp);

  });

  socket.on('icecandidate', (icecandidate, roomId) => {
    addLog('Routing ICE candidate');
    socket.broadcast.to(roomId).emit('icecandidate', icecandidate);
  });

  socket.on("available-screens", (screens, roomId) => {
    addLog(`Available screens: ${screens}`);
    socket.broadcast.to(roomId).emit('available-screens', screens);
  });

  socket.on("screen-change", (selectedScreen, roomId) => {
    addLog(`Selected screen: ${selectedScreen}`);
    socket.broadcast.to(roomId).emit('screen-change', selectedScreen);
  });

  // socket.on('selectedScreen', (selectedScreen) => {
  //   addLog(`Selected screen: ${selectedScreen}`);
  //   socket.broadcast.emit('selectedScreen', selectedScreen);
  // });

  socket.on('mouse-move', (data, roomId) => {
    addLog(`Mouse move: ${data}`);
    socket.broadcast.to(roomId).emit('mouse-move', data);
  });

  socket.on('mouse-click', (data, roomId) => {
    addLog(`Mouse click: ${data}`);
    socket.broadcast.to(roomId).emit('mouse-click', data);
  });

  socket.on('mouse-scroll', (data, roomId) => {
    addLog(`Mouse scroll: ${data}`);
    socket.broadcast.to(roomId).emit('mouse-scroll', data);
  });

  socket.on('key-up', (data, roomId) => {
    addLog(`Key up: ${data}`);
    socket.broadcast.to(roomId).emit('key-up', data);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    room.delete(roomId);
    addLog(`User left the room: ${roomId}`);
    socket.broadcast.to(roomId).emit('user-left', roomId);
  });


  socket.on('disconnect', () => {
    addLog('User disconnected');
  });
});

server.listen(PORT, () => {
  addLog(`Server is running on port ${PORT}`);
});
