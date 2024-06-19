import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from "socket.io-client";
import { useRoom } from './context/RoomContext';

declare global {
  interface Window {
    electronAPI: {
      getScreenId: (callback: (event: any, screenId: string) => void) => void;
      setSize: ({ width, height }: { width: number; height: number }) => void;
      getAvailableScreens: (callback: (event: any, screens: { id: string, name: string }[]) => void) => void;
      sendMouseMove: (data: { x: number, y: number }) => void;
      sendMouseClick: (data: { x: number, y: number, button: number }) => void;
      sendKeyUp: (data: { key: string, code: string }) => void;
    };
  }
}

const App: React.FC = () => {
  const { roomId, setRoomId } = useRoom();
  const videoRef = useRef<HTMLVideoElement>(null);
  const socket = useMemo(() => io("http://localhost:5008"), []);
  const [availableScreens, setAvailableScreens] = useState<{ id: string, name: string }[]>([]);
  // const [roomId, setRoomId] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  const rtcPeerConnection = useRef<RTCPeerConnection | null>(new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
  }) as RTCPeerConnection);

  const handleStream = (stream: MediaStream, roomId:string) => {
    // if (videoRef.current) {
    //   videoRef.current.srcObject = stream;

      const sender = rtcPeerConnection.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(stream.getVideoTracks()[0]);
      } else {
        stream.getTracks().forEach(track => {
          rtcPeerConnection.current?.addTrack(track, stream);
        });
      }

      // videoRef.current.onloadedmetadata = () => {
      //   videoRef.current?.play();
      // };

      // Notify the remote peer about the new stream
      rtcPeerConnection.current?.createOffer().then(sdp => {
        rtcPeerConnection.current?.setLocalDescription(sdp);
        socket.emit("offer", JSON.stringify(sdp), roomId);
      });
    // }
  };

  const getStream = async (screenId: string, roomId:string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenId,
          } as any, // Add this line to avoid TypeScript error
        }
      });

      handleStream(stream, roomId);

    } catch (e) {
      console.log(e);
    }
  };


  const handleTrack = (e: RTCTrackEvent) => {
    console.log('Track received:', e.streams[0]);
    if (videoRef.current) {
      console.log('Track received:', e.streams[0]);
      videoRef.current.srcObject = e.streams[0];
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }
  }     


  useEffect(() => {

    console.log("Room ID:", roomId);
    socket.emit("join-room", roomId);
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.emit("electron-app", "Hello from Electron App");



    // Listen for available screens from the main process
    window.electronAPI.getAvailableScreens((_, screens) => {
      setAvailableScreens(screens);
    });

    socket.on("user-joined", (roomId)=>{
      setRoomId(roomId);
      // window.electronAPI.getScreenId((_, screenId) => {
      //   console.log('Renderer...', screenId);
        getStream("screen:1:0", roomId);
      // });
    })

    socket.on("offer", async (sdp: string, roomId:string) => {
      console.log('Offer received:', sdp);
      const offer = new RTCSessionDescription(JSON.parse(sdp));
      rtcPeerConnection.current?.setRemoteDescription(offer)
        .then(() => rtcPeerConnection.current?.createAnswer())
        .then(answer => {
          rtcPeerConnection.current?.setLocalDescription(answer);
          socket.emit("answer", JSON.stringify(answer), roomId);
        });
    });

    socket.on('answer', (sdp: string) => {
      console.log('Answer received:', sdp);
      const answer = new RTCSessionDescription(JSON.parse(sdp));
      rtcPeerConnection.current?.setRemoteDescription(answer);
    });

    socket.on('icecandidate', (candidate: string) => {
      console.log('ICE Candidate received:', candidate);
      rtcPeerConnection.current?.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
    });

    socket.on("mouse-move", (data) => {
      console.log("Mouse move: ", data);
      window.electronAPI.sendMouseMove(data);
    });

    socket.on("mouse-click", (data) => {
      console.log("Mouse click: ", data);
      window.electronAPI.sendMouseClick(data);
    });

    socket.on("key-up", (data) => {
      console.log("Key up: ", data);
      window.electronAPI.sendKeyUp(data);
    });

    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('ICE Candidate:', roomId, JSON.stringify(e.candidate));
          socket.emit('icecandidate', JSON.stringify(e.candidate), roomId);
        }
      };

      rtcPeerConnection.current.onconnectionstatechange = (e) => {
        console.log('Connection state', rtcPeerConnection.current?.connectionState);
        setConnectionState(rtcPeerConnection.current?.connectionState || 'disconnected');
      };
   

    rtcPeerConnection.current.addEventListener("track", handleTrack);

    //  rtcPeerConnection.current.ontrack = (e) => {
    //   console.log('Track received:', e.streams[0]);
    //   // handleStream(e.streams[0]);

    //   if (videoRef.current) {
    //     console.log('Track received:', e.streams[0]);
    //     videoRef.current.srcObject = e.streams[0];
    //     videoRef.current.onloadedmetadata = () => {
    //       videoRef.current?.play();
    //     };
    //   }
    // }
  }

    return () => {
      socket.close();
      rtcPeerConnection.current?.removeEventListener("track", handleTrack);
      // rtcPeerConnection.current?.close();
    };
  }, []);  
  // const switchScreen = (screenId: string) => {
  //   getStream(screenId);
  // };

  // const handleCreateRoom = () => {
  //   const roomId = uuidv4().slice(0, 8); // Shorter room ID

  //   socket.emit("join-room", roomId);
  //   setRoomId(r => roomId);
  //   // console.log('Room ID:', roomId);
  //   // testRoomId()
  // };

  const handleJoinRoom = () => {
    if (joinRoomId.trim()) {
      socket.emit("join-room", joinRoomId);
      setRoomId(joinRoomId);
    }
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).then(() => {
        console.log("Room ID copied to clipboard");
      }).catch(err => {
        console.error("Failed to copy Room ID: ", err);
      });
    }
  };

  // const handleLeaveRoom = () => {
  //   socket.emit("leave-room", roomId);
  //   setRoomId(null);
  // };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    socket.emit("mouse-move",{ x: e.clientX, y: e.clientY }, roomId);
  };

  const handleMouseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    socket.emit("mouse-click",{ x: e.clientX, y: e.clientY, button: e.button }, roomId);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    socket.emit("key-up",{ key: e.key, code: e.code }, roomId);
  };

  return (
    <div className="App">
      { connectionState === "disconnected" && 
        <>
        <div>
         {roomId &&  <h2>{roomId}</h2>}
          <button onClick={handleCopyRoomId}>Copy Room ID</button>
          {/* <button onClick={handleLeaveRoom}>Back</button> */}
        </div>
        
        <div>
          {/* <button onClick={handleCreateRoom}>
            Share Screen
          </button> */}

          <div>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Enter Room ID"
            />
            <button onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>
        </div>
      
        </>
      }
      
        <div style={{display:"block"}} onMouseMove={handleMouseMove} onClick={handleMouseClick} onKeyUp={handleKeyUp} tabIndex={0}>
          <video ref={videoRef} className="video" style={{ maxWidth: "100%" }}>video not available</video>
        </div>
      
    </div>
  );
};

export default App;
