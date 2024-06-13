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
const PORT = 5000;
const allowedOrigins = "*";
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["X-Requested-With", "Content-Type"]
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
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
const connections = io.of('/remote-ctrl');
connections.on('connection', (socket) => {
    addLog('USER Connection established');
    socket.on("electron-app", (data) => {
        addLog(`Electron App text: ${data}`);
    });
    socket.on("join-message", (roomId) => {
        socket.join(roomId);
        addLog(`User joined in a room: ${roomId}`);
    });
    socket.on("screen-data", function (data) {
        data = JSON.parse(data);
        var room = data.room;
        var imgStr = data.image;
        socket.broadcast.to(room).emit('screen-data', imgStr);
        addLog(`Screen data received for room: ${room}`);
    });
    socket.on('offer', (sdp) => {
        addLog('Routing offer');
        socket.broadcast.emit('offer', sdp);
    });
    socket.on('answer', (sdp) => {
        addLog('Routing answer');
        socket.broadcast.emit('answer', sdp);
    });
    socket.on('icecandidate', (icecandidate) => {
        addLog('Routing ICE candidate');
        socket.broadcast.emit('icecandidate', icecandidate);
    });
    socket.on('selectedScreen', (selectedScreen) => {
        addLog(`Selected screen: ${selectedScreen}`);
        socket.broadcast.emit('selectedScreen', selectedScreen);
    });
    socket.on('mouse-move', (data) => {
        addLog(`Mouse move: ${data}`);
        socket.broadcast.emit('mouse-move', data);
    });
    socket.on('mouse-click', (data) => {
        addLog(`Mouse click: ${data}`);
        socket.broadcast.emit('mouse-click', data);
    });
    socket.on('key-up', (data) => {
        addLog(`Key up: ${data}`);
        socket.broadcast.emit('key-up', data);
    });
    socket.on('disconnect', () => {
        addLog('User disconnected');
    });
});
server.listen(PORT, () => {
    addLog(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map