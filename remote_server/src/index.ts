import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import { configDotenv } from 'dotenv';

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

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    addLog(`User joined in a room: ${roomId}`);
    socket.broadcast.to(roomId).emit('user-joined', roomId);
  });

  socket.on("screen-data", function(data) {
    data = JSON.parse(data);
    var room = data.room;
    var imgStr = data.image;
    socket.broadcast.to(room).emit('screen-data', imgStr);
    addLog(`Screen data received for room: ${room}`);
  });

  socket.on('offer', (sdp, roomId) => {
    addLog('Routing offer'+roomId);
    socket.broadcast.to(roomId).emit('offer', sdp, roomId);
  });

  socket.on('answer', (sdp, roomId) => {
    addLog('Routing answer '+roomId);
    socket.broadcast.to(roomId).emit('answer', sdp);

  });

  socket.on('icecandidate', (icecandidate, roomId) => {
    addLog('Routing ICE candidate');
    socket.broadcast.to(roomId).emit('icecandidate', icecandidate);
  });

  socket.on('selectedScreen', (selectedScreen) => {
    addLog(`Selected screen: ${selectedScreen}`);
    socket.broadcast.emit('selectedScreen', selectedScreen);
  });

  socket.on('mouse-move', (data, roomId) => {
    addLog(`Mouse move: ${data}`);
    socket.broadcast.to(roomId).emit('mouse-move', data);
  });

  socket.on('mouse-click', (data, roomId) => {
    addLog(`Mouse click: ${data}`);
    socket.broadcast.to(roomId).emit('mouse-click', data);
  });

  socket.on('key-up', (data, roomId) => {
    addLog(`Key up: ${data}`);
    socket.broadcast.to(roomId).emit('key-up', data);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
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
