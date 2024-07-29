"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)({
    path: "./.env"
});
const PORT = 5008;
const allowedOrigins = ["https://remote-desk-web.vercel.app", "http://localhost:5173"];
const app = (0, express_1.default)();
const logs = [];
function addLog(message) {
    const timestamp = new Date().toISOString();
    const log = `${timestamp} - ${message}`;
    logs.push(log);
    console.log(log);
}
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static("public"));
app.get("/", (req, res) => {
    const ipAddress = req.header('x-forwarded-for') || req.socket.remoteAddress || req.ip;
    addLog(`IP Address: ${ipAddress}`);
    return res.status(200).json({ message: "Welcome to Remote-Desk server" });
});
app.get('/view', (req, res) => {
    res.sendFile(__dirname + '/display.html');
});
app.get('/logs', (req, res) => {
    res.status(200).json({ logs });
});
const room = new Map();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        // credentials: true
    }
});
io.on('connection', (socket) => {
    addLog('USER Connection established');
    socket.on("electron-app", (data) => {
        addLog(`Electron App text: ${data}`);
    });
    socket.on("join-room", (roomId, id = "") => {
        if (room.has(roomId)) {
            addLog(`Second user to room: ${roomId}`);
            // socket.emit('room-exists', roomId);
            const socketId = room.get(roomId);
            if (id === socketId) {
                addLog('id matched');
                socket.join(roomId);
                io.to(socketId).emit('get-offer', roomId);
            }
        }
        else {
            socket.join(roomId);
            room.set(roomId, socket.id);
            addLog(`User joined in a room: ${roomId}`);
        }
        // socket.broadcast.to(roomId).emit('user-joined', roomId);
    });
    socket.on("request-screen-share", (roomId, hostname) => {
        addLog(`Screen share requested for room: ${roomId}, hostname: ${hostname}`);
        if (room.has(roomId)) {
            // socket.join(roomId);
            const socketId = room.get(roomId);
            socket.to(socketId).emit('screen-share-request', socket.id, hostname);
        }
        else {
            addLog(`Room not found: ${roomId}`);
            socket.emit('room-not-found', roomId);
        }
    });
    socket.on("screen-share-response", (roomId, accepted, requesterId) => {
        if (accepted) {
            addLog(`Screen share accepted for room: ${roomId}`);
            io.to(requesterId).emit('screen-share-accepted', roomId, socket.id);
        }
        else {
            addLog(`Screen share denied for room: ${roomId}`);
            io.to(requesterId).emit('screen-share-denied', roomId);
        }
    });
    socket.on("screen-data", function (data) {
        data = JSON.parse(data);
        var room = data.room;
        var imgStr = data.image;
        socket.broadcast.to(room).emit('screen-data', imgStr);
        addLog(`Screen data received for room: ${room}`);
    });
    socket.on('offer', (sdp, roomId) => {
        // socket.join(roomId);
        addLog('Routing offer: ' + roomId);
        socket.broadcast.to(roomId).emit('offer', sdp, roomId);
    });
    socket.on('answer', (sdp, roomId) => {
        addLog('Routing answer: ' + roomId);
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
//# sourceMappingURL=index.js.map