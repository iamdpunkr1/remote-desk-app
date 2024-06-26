import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from "socket.io-client";
import { useRoom } from './context/RoomContext';
import './App.css';
import { v4 as uuidv4 } from 'uuid';
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
  const socket = useMemo(() => io("https://alegralabs.com:5007"), []);
  const [availableScreens, setAvailableScreens] = useState<{ id: string, name: string }[]>([]);
  // const [roomId, setRoomId] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  // const [isSharing, setIsSharing] = useState<boolean>(false);
  const [trackReceived, setTrackReceived] = useState<boolean>(false);

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
    if(e.streams[0]){
      setTrackReceived(true);
    }
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
    // socket.emit("join-room", roomId);
    socket.on("connect", () => {
      console.log("Connected to server");
      socket.emit("join-room", roomId);
      socket.emit("electron-app", "Hello from Electron App");
    });

    


    // Listen for available screens from the main process
    window.electronAPI.getAvailableScreens((_, screens) => {
      setAvailableScreens(screens);
    
    });

    socket.on("user-joined", (roomId)=>{
      setRoomId(roomId);
      // window.electronAPI.getScreenId((_, screenId) => {
      //   console.log('Renderer...', screenId);
        getStream("screen:0:0", roomId);
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
          // setIsSharing(s=>true);
          // console.log("isSharing", isSharing);
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

    socket.on("user-left", () => {
      console.log("User left");
      handleDisconnect();
    });

    
    return () => {
      socket.close();
      rtcPeerConnection.current?.removeEventListener("track", handleTrack);
      rtcPeerConnection.current?.close();
      rtcPeerConnection.current = null;
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
      // setIsSharing(false);
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
    // console.log("Mouse Move")
    if(connectionState === "connected" && videoRef.current){
      const videoRect = videoRef.current.getBoundingClientRect();
      const relativeX = (e.clientX - videoRect.left) / videoRect.width;
      const relativeY = (e.clientY - videoRect.top) / videoRect.height;
      
      socket.emit("mouse-move", {
        x: relativeX,
        y: relativeY,
        clientWidth: videoRect.width,
        clientHeight: videoRect.height
      }, roomId);
    }
  };

  const handleMouseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if(connectionState === "connected") 
      socket.emit("mouse-click",{ x: e.clientX, y: e.clientY, button: e.button }, roomId);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if(connectionState === "connected")
      socket.emit("key-up",{ key: e.key, code: e.code }, roomId);
  };

  const handleDisconnect = () => {

    // Close the RTC peer connection
    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.close();
      rtcPeerConnection.current = null;
      // rtcPeerConnection.current = new RTCPeerConnection({
      //   iceServers: [
      //     { urls: 'stun:stun1.l.google.com:19302' },
      //     { urls: 'stun:stun3.l.google.com:19302' },
      //     { urls: 'stun:stun4.l.google.com:19302' }
      //   ],
      // }) 
    }
  
    // Reset connection state and any related states
    setConnectionState('disconnected');
    setTrackReceived(false);

    const newRoomID = uuidv4().slice(0, 8);
  
    // Emit leave room event to the socket server if needed
    socket.emit('leave-room', roomId);
    setRoomId(newRoomID);
    socket.emit('join-room', newRoomID);
  };

  


  return (
    <section className="flex flex-col justify-center items-center h-screen">
    
    {
    connectionState === "disconnected" &&
    <>

      <div className="flex justify-center">
        <div className='space-y-1'>
        <h6 className='text-xs'>
          Your ID
        </h6>
        <div className='flex justify-between border-solid border-2 border-gray-400 rounded-md flex gap-6 px-2 py-1 w-64'>
            {roomId &&  <h2 className='text-sm'>{roomId}</h2>}
            <button onClick={handleCopyRoomId} className='hover:scale-125'>
              <span
                style={{
                  fontSize: ".675em",
                  marginRight: ".125em",
                  position: "relative",
                  top: "-.25em",
                  left: "-.125em"
                }}
              >
                📄
                <span style={{ position: "absolute", top: ".25em", left: ".25em" }}>📄</span>
              </span>
            </button>
        </div>
        </div>
      </div>
      
      <div className="mt-6 space-y-1">
        <h6 className='text-xs'>
          Remote ID
        </h6>
        <div className='relative'>
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Enter Remote ID"
            className='focus:outline-none  text-indigo-600 focus:border-indigo-700 border-solid border-2 border-gray-400 rounded-md px-2 py-1 bg-trasparent w-64 text-sm'
          />
          <button onClick={handleJoinRoom} className='hover:bg-indigo-500 hover:border-indigo-500 bg-indigo-700 border-solid border-[2px] border-indigo-700 rounded-r-md px-2 py-1  absolute -right-1 top-0'>
             <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="#fff"
              viewBox="0 0 24 24"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m11 16 4-4m0 0-4-4m4 4H3m1.516 5a9 9 0 1 0 0-10"
              />
            </svg>
          </button>
        </div>
      </div>
    </>          
    }

    {
      connectionState === "connecting" &&
      <div>
        Connecting...
      </div>
    }

{
      connectionState === "connected" && !trackReceived &&
      <div>
        <h6>Connected, Your screen is being shared</h6>
        <button onClick={handleDisconnect}
                   className=' bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded-md'>
                <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="#fff"
                stroke="#fff"
                viewBox="0 0 1024 1024"
                className='w-5 h-5'
              >
                <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
              </svg>     
      </button> 
      </div>
    }


      {
      // connectionState === "connecting" || trackReceived  &&
      <div className='relative'  style={{display:`${ trackReceived ? "block" : "none"}`}} onMouseMove={handleMouseMove} onClick={handleMouseClick} onKeyUp={handleKeyUp} tabIndex={0}>
        { 
          connectionState === "connected" &&
           <button onClick={handleDisconnect}
                   className='absolute top-0 right-0 bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded-md'>
                <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="#fff"
                stroke="#fff"
                viewBox="0 0 1024 1024"
                className='w-5 h-5'
              >
                <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
              </svg>     
            </button> 
        }   
        <video ref={videoRef} className="video" style={{ width: "100%" }}>
          video not available
        </video>
      </div>
      }
  </section>
  );
};

export default App;


