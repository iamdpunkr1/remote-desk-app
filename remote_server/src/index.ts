import express, { Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import { configDotenv } from 'dotenv';

configDotenv({
    path: "./.env"
});

const PORT = process.env.PORT || 5000;
const allowedOrigins = "*"; // Update with your frontend's URL

const app: Application = express();

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));
app.get("/", (req, res) => {
  const ipAddress = req.header('x-forwarded-for') || req.socket.remoteAddress || req.ip;
  console.log("IP Address: ", ipAddress);
  return res.status(200).json({ message: "Welcome to Remote-Desk server" });
});

app.get('/view', (req, res) => {
  res.sendFile(__dirname + '/display.html');
})

const server: HTTPServer = createServer(app);
const io: SocketIOServer = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const connections = io.of('/remote-ctrl');

connections.on('connection', (socket: Socket) => {
  console.log('USER Connection established');

  socket.on("electron-app", (data) => {
    console.log("Electron App text: ", data);
  } );

  socket.on("join-message", (roomId) => {
    socket.join(roomId);
    console.log("User joined in a room : " + roomId);
})

socket.on("screen-data", function(data) {
    data = JSON.parse(data);
    var room = data.room;
    var imgStr = data.image;
    socket.broadcast.to(room).emit('screen-data', imgStr);
})

  socket.on('offer', (sdp) => {
    console.log('Routing offer');
    socket.broadcast.emit('offer', sdp);
  });

  socket.on('answer', (sdp) => {
    console.log('Routing answer');
    socket.broadcast.emit('answer', sdp);
  });

  socket.on('icecandidate', (icecandidate) => {
    console.log('Routing ICE candidate');
    socket.broadcast.emit('icecandidate', icecandidate);
  });

  socket.on('selectedScreen', (selectedScreen) => {
    console.log('Selected screen:', selectedScreen);
    socket.broadcast.emit('selectedScreen', selectedScreen);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
