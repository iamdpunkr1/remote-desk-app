import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from "socket.io-client";
import { useRoom } from './context/RoomContext';
import './App.css';
import { v4 as uuidv4 } from 'uuid';
// import remote_desk_icon from './assets/remote_desk_icon.svg';


type screenType = {
  id:string,
  name:string,
  display_id:string
}

const modiferCheckers = (e: React.KeyboardEvent<HTMLDivElement>) => {
  const modifier:string[] = [];
  if (e.ctrlKey) {
    modifier.push("control");
  }
  if (e.altKey) {
    modifier.push("alt");
  }
  if (e.shiftKey) {
    modifier.push("shift");
  }
  if (e.metaKey) {
    modifier.push("Meta");
  }
  return modifier;
}

const Rtc: React.FC = () => {
  const { roomId, setRoomId } = useRoom();
  const videoRef = useRef<HTMLVideoElement>(null);
  const socket = useMemo(() => io("https://alegralabs.com:5007"), []);
  const availableScreensRef = useRef<screenType[]>([]);
  const [screensRecieved, setScreensRecieved] =  useState<screenType[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<string>("");
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [trackReceived, setTrackReceived] = useState<boolean>(false);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const [videoRects, setVideoRects] = useState<DOMRect | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // const [isQuitting, setIsQuitting] = useState<boolean>(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const joinedRoomId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // iceServers: [{"urls":"stun:stun.relay.metered.ca:80"},{"urls":"turn:global.relay.metered.ca:80","username":"3e2ccebf3fdd5a1c83bc7a32","credential":"3oLWpjBdOIDoqMOh"},{"urls":"turn:global.relay.metered.ca:80?transport=tcp","username":"3e2ccebf3fdd5a1c83bc7a32","credential":"3oLWpjBdOIDoqMOh"},{"urls":"turn:global.relay.metered.ca:443","username":"3e2ccebf3fdd5a1c83bc7a32","credential":"3oLWpjBdOIDoqMOh"},{"urls":"turns:global.relay.metered.ca:443?transport=tcp","username":"3e2ccebf3fdd5a1c83bc7a32","credential":"3oLWpjBdOIDoqMOh"}],

  const rtcPeerConnection = useRef<RTCPeerConnection | null>(new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:freestun.net:3479',
        username: 'free',
        credential: 'free',
      }   
    ],
  }) as RTCPeerConnection);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  // const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // const checkOnlineStatus = async () => {
  //   console.log("Checking online status...");
  //   const pc = new RTCPeerConnection({
  //     iceServers: [
  //       { urls: 'stun:stun1.l.google.com:19302' },
  //       {
  //         urls: 'turn:freestun.net:3479',
  //         username: 'free',
  //         credential: 'free',
  //       }
  //     ]
  //   });

  //   try {
  //     pc.createDataChannel("");
  //     const offer = await pc.createOffer();
  //     await pc.setLocalDescription(offer);

  //     let isConnected = false;
  //     const timeout = new Promise<boolean>((resolve) => {
  //       setTimeout(() => resolve(false), 5000);  // 5 seconds timeout
  //     });

  //     const checkConnection = new Promise<boolean>((resolve) => {
  //       pc.onicecandidate = (e) => {
  //         if (e.candidate === null) {
  //           console.log("ICE Candidate online status: ", pc.iceConnectionState);
  //           resolve(pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
  //         }
  //       };
  //     });

  //     isConnected = await Promise.race([checkConnection, timeout]);
  //     console.log("Online status:", isConnected);
  //     setIsOnline(isConnected);
  //   } catch (err) {
  //     console.error("Error checking online status:", err);
  //     setIsOnline(false);
  //   } finally {
  //     pc.close();
  //   }
  // };
  // const [isChecked, setIsChecked] = useState<boolean>(false);

  // const handleToggle = () => {
  //   setIsChecked(!isChecked);
  // };

  const handleDataChannelMessage =async (event: MessageEvent) => {

   
    const data = JSON.parse(event.data);
    console.log("Data Channel Message: ", data);
    switch (data.type) {
      case 'mouse-move':
        window.electronAPI.sendMouseMove(data.payload);
        break;
      case 'mouse-click':
        window.electronAPI.sendMouseClick(data.payload);
        break;
      case 'key-up':
        window.electronAPI.sendKeyUp(data.payload);
        break;
      case 'mouse-scroll':
        window.electronAPI.sendMouseScroll(data.payload);
        break;
      case 'mouse-down':
        window.electronAPI.sendMouseDown(data.payload);
        break;
      case 'mouse-up':
        window.electronAPI.sendMouseUp(data.payload);
        break;
     

    }
  };


  const handleStream = (stream: MediaStream, roomId:string) => {

      const sender = rtcPeerConnection.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(stream.getVideoTracks()[0]);
      } else {
        stream.getTracks().forEach(track => {
          rtcPeerConnection.current?.addTrack(track, stream);
        });
      }


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
          } 
        }as any
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
        console.log("Video playing");
      setLoading(false);

      };
      setRoomId(joinRoomId);
    }

  }     



  const createPeerConnection = () => {
    const newPeerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:freestun.net:3479',
          username: 'free',
          credential: 'free',
        }
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10
    });
  
    newPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, roomId });
      }
    };
  
    newPeerConnection.ontrack = handleTrack;
  
    newPeerConnection.onconnectionstatechange = () => {
      setConnectionState(newPeerConnection.connectionState);
      console.log('ICE connection state:', newPeerConnection.iceConnectionState);
      if (newPeerConnection.iceConnectionState === 'failed') {
        setTrackReceived(false)
        // Trigger ICE restart
        newPeerConnection.restartIce();
      }
    };
  
    newPeerConnection.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      dataChannel.current.onmessage = handleDataChannelMessage;
    };
  
    return newPeerConnection;
  };


  const gatherIceCandidates = (peerConnection: RTCPeerConnection, timeout = 5000) => {
    return new Promise<void>((resolve) => {
      const candidates: RTCIceCandidate[] = [];
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
        } else {
          resolve();
        }
      };
  
      setTimeout(resolve, timeout);
    });
  };

  const handleAppClosing = () => {
    console.log("App closing event received");
    // setIsQuitting(true);
    const hasActiveConnection = videoRef.current?.srcObject !== null;
    // console.log("Connection state: ", ); 
    // console.log("Has active connection: ", hasActiveConnection);
    window.electronAPI.sendConfirmQuit(hasActiveConnection);
  };

  const handleForcedDisconnect = async () => {
 
    // await handleDisconnect();
    console.log("Forced disconnect event received: ", joinedRoomId.current);
    socket.emit('leave-room', joinedRoomId.current);
    setTimeout(() => {
      window.electronAPI.sendQuitApp();
    }, 1000);
    // window.electronAPI.sendQuitApp();
  };

  useEffect(() => {
     // Initial check
    //  checkOnlineStatus();

     // Set up interval for periodic checks
    //  connectionCheckInterval.current = setInterval(checkOnlineStatus, 5000);  // Check every 30 seconds
 

    rtcPeerConnection.current = createPeerConnection();

      // Listen for app closing event
    window.electronAPI.onAppClosing(handleAppClosing);

    // Listen for disconnect request
    window.electronAPI.onPerformDisconnect(handleForcedDisconnect);

    // Listen for quit cancelled event
    // window.electronAPI.onQuitCancelled(() => setIsQuitting(false));

    // console.log("SUpported Constraints: ",navigator.mediaDevices.getSupportedConstraints())

    // if(rtcPeerConnection.current){
    //   console.log("Data Channel created");
    //   dataChannel.current = rtcPeerConnection.current.createDataChannel("dataChannel");
    //   dataChannel.current.onopen = () => {
    //     console.log('Data channel is open');
    //   };

    //   dataChannel.current.onmessage = handleDataChannelMessage;
    // }

    
    // console.log("Room ID:", roomId);
    // socket.emit("join-room", roomId);
    socket.on("connect", () => {
      console.log("Connected to server");
      socket.emit("join-room", roomId);
      socket.emit("electron-app", "Hello from Electron App");
      setIsOnline(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsOnline(false);
    });

    socket.on("reconnect", () => {
      console.log("Reconnected to server");
      setIsOnline(true);
    });

    socket.on("reconnect_error", () => {
      console.log("Reconnect error");
      setIsOnline(false);

    });

    socket.on("connect_error", () => {
      console.log("Connect error");
      setIsOnline(false);
    });

    
  

    // Listen for available screens from the main process
    window.electronAPI.getAvailableScreens((_, screens) => {
      console.log('Available screens: ', screens.length);
      console.log("Room ID:", roomId);
      console.log("Connection State:", connectionState);

      availableScreensRef.current = screens;
      setSelectedScreen(screens[0].id);
      if(screens.length > 0 && roomId){
        console.log("Available screens emitted to SOCKET: ", screens);
         socket.emit("available-screens", screens, roomId);
      }
    });

    socket.on("room-not-found", (roomId) => {
      console.log("Room not found: ", roomId);
      setError("Remote PC not found");
      setLoading(false);

    });

    socket.on("screen-share",async (roomId)=>{
      setRoomId(roomId);

    console.log("availableScreens", availableScreensRef.current);
    if (availableScreensRef.current.length > 0) {
      console.log("screen id: ", availableScreensRef.current[0].id);
      getStream(availableScreensRef.current[0].id, roomId);
    } else {
      console.log("No available screens");
    }

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
      if(availableScreensRef.current.length > 1){
      socket.emit("available-screens", availableScreensRef.current, roomId);
      }
    });

    socket.on("available-screens", (screens: screenType[]) => {
      console.log('Screens recieved: ', screens);
      setScreensRecieved(screens);

    } );

    socket.on('icecandidate', (candidate: string) => {
      // console.log('ICE Candidate received:', candidate);
      // rtcPeerConnection.current?.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
      const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
      rtcPeerConnection.current?.addIceCandidate(iceCandidate)
       .catch(e => console.error('Error adding received ice candidate', e));
    });


    socket.on("screen-change", (screen: screenType) => {
      console.log('Screen change:', screen);
      if(roomId){
        getStream(screen.id, roomId);
        window.electronAPI.sendScreenChange(screen.display_id);
      }
    });

    
    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('ICE Candidate:', roomId, JSON.stringify(e.candidate));
          socket.emit('icecandidate', JSON.stringify(e.candidate), roomId);
        }
      };

      rtcPeerConnection.current.onconnectionstatechange = (_) => {
        console.log('Connection state', rtcPeerConnection.current?.connectionState);
        setConnectionState(rtcPeerConnection.current?.connectionState || 'disconnected');
      };

    // rtcPeerConnection.current.addEventListener("track", handleTrack);

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

      // if (connectionCheckInterval.current) {
      //   clearInterval(connectionCheckInterval.current);
      // }
      socket.close();
      
      // rtcPeerConnection.current?.removeEventListener("track", handleTrack);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []); 

  // useEffect(() => {
  //   // ... existing code
  //   if(rtcPeerConnection.current){
  //   rtcPeerConnection.current.ondatachannel = (event) => {
  //     console.log("Data Channel created event ", event);
  //     dataChannel.current = event.channel;
  //   };
  //   }
    
  // }, []);

  
  
  // Function to handle resize events
  const handleResize = (entries: ResizeObserverEntry[]) => {
    for (let entry of entries) {

      if (entry.target === videoRef.current) {
        setVideoRects(entry.target.getBoundingClientRect());
      }
    }
  };

  useEffect(() => {
    // Create a ResizeObserver to monitor video element size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (videoRef.current) {
      resizeObserver.observe(videoRef.current);
      console.log("video Rect: ", videoRects)
      setVideoRects(videoRef.current.getBoundingClientRect()); // Initialize videoRects
    }

    return () => {
      resizeObserver.disconnect();
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

  const handleMouseScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if(connectionState === "connected"){
      const { deltaX, deltaY } = e;
      
      console.log("Mouse Scroll", deltaX, deltaY);
      // Emit scroll data to server via Socket.io
    //   socket.emit("mouse-scroll", { deltaX, deltaY }, roomId);
        if(dataChannel.current){
            console.log("mouse scroll sent via RTC: ");
            dataChannel.current.send(JSON.stringify({
                type: 'mouse-scroll',
                payload: { deltaX, deltaY }
            }));
        }
    }
  }


  const handleMouseDown = (_: React.MouseEvent<HTMLDivElement>) => {
    if(dataChannel.current){
      console.log("mouse down sent via RTC: ");
      dataChannel.current.send(JSON.stringify({
          type: 'mouse-down',
          payload: true
        }));
  }
  }

  const handleMouseUp = (_: React.MouseEvent<HTMLDivElement>) => {
    if(dataChannel.current){
      console.log("mouse up sent via RTC: ");
      dataChannel.current.send(JSON.stringify({
          type: 'mouse-up',
          payload: true
        }));
  }
  }

  // const handleJoinRoom = () => {
  //   setLoading(true);
  //   if (joinRoomId.trim()) {
  //     socket.emit("join-room", joinRoomId);

  //   }
    
  // };
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  
  const handleJoinRoom = async (retryCount = 0) => {
    if(joinRoomId.trim() ===  roomId){
      setError("You can't join your own room");
      return;
    }

    setError(null);
    setLoading(true);
    // console.log("Join Room ID: ", joinRoomId);
    joinedRoomId.current = joinRoomId;
    if (joinRoomId.trim()) {
      try {
        if (rtcPeerConnection.current) {
          rtcPeerConnection.current.close();
        }
        
        rtcPeerConnection.current = createPeerConnection();
        
        dataChannel.current = rtcPeerConnection.current.createDataChannel("dataChannel");
        dataChannel.current.onopen = () => {
          console.log('Data channel is open');
        };
        dataChannel.current.onmessage = handleDataChannelMessage;
  
        socket.emit("screen-share", joinRoomId);
  
        // Wait for ICE candidates to be gathered
        await gatherIceCandidates(rtcPeerConnection.current);
  
        const offer = await rtcPeerConnection.current.createOffer();
        await rtcPeerConnection.current.setLocalDescription(offer);
  
        socket.emit("offer", JSON.stringify(offer), joinRoomId);
  
        // Wait for the connection to be established
        await new Promise<void>((resolve, reject) => {
          const checkState = () => {
            if (rtcPeerConnection.current?.connectionState === 'connected') {
              resolve();
            } else if (rtcPeerConnection.current?.connectionState === 'failed') {
              reject(new Error('Connection failed'));
            } else {
              setTimeout(checkState, 5000);
            }
          };
          checkState();
        });
  
        // setLoading(false);
        setRoomId(joinRoomId);
      } catch (error) {
        console.log('Connection error:', error);
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying... Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
          setTimeout(() => handleJoinRoom(retryCount + 1), RETRY_DELAY);
        } else {
          setLoading(false);
          console.log('Max retries reached. Connection failed.');
        }
      }
    }
    setJoinRoomId('');
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


  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connectionState === "connected" && videoRef.current && videoRects) {
      console.log("Mouse move called");
      // const videoRect = videoRef.current.getBoundingClientRect();

      const relativeX = (e.clientX - videoRects.left) / videoRects.width;
      const relativeY = (e.clientY - videoRects.top) / videoRects.height;
      
      if (dataChannel.current) {
        const message = JSON.stringify({
          type: 'mouse-move',
          payload: {
            x: relativeX,
            y: relativeY,
          }
        });
        // console.timeEnd("Mouse move");
        // Example using requestAnimationFrame to throttle updates
        // if (!mouseMoveTimeout.current) {
        //   mouseMoveTimeout.current = requestAnimationFrame(() => {
        //     dataChannel.current!.send(message);
        //     mouseMoveTimeout.current = null;
        //   });
        // }

         // Example of debouncing using useRef to store timeout ID
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        dataChannel.current!.send(message);
        debounceTimeout.current = null;
      }, 14); // Adjust the delay as needed
      }
    }
  };
  

  const handleMouseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if(connectionState === "connected") 
    //   socket.emit("mouse-click",{ x: e.clientX, y: e.clientY, button: e.button }, roomId);
      if(dataChannel.current){
        console.log("mouse click sent via RTC: ");
        if(dataChannel.current){
            console.log("mouse move sent via RTC: ");
            dataChannel.current.send(JSON.stringify({
                type: 'mouse-click',
                payload: { x: e.clientX, y: e.clientY, button: e.button }
              }));
        }
      
      }
  };


  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if(connectionState === "connected"){
      // console.log("Key up", e);
      const modifier = modiferCheckers(e);
      console.log("Modifers:  ", modifier);

    //   socket.emit("key-up",{ key: e.key, code: modifier }, roomId);

      if(dataChannel.current){
        console.log("key up sent via RTC: ");
        dataChannel.current.send(JSON.stringify({
            type: 'key-up',
            payload: { key: e.key, code: modifier }
          }));
      }
    }
  };

  // const handleDisconnect = () => {

  //   // Close the RTC peer connection
  //   if (rtcPeerConnection.current) {
  //     rtcPeerConnection.current.close();
  //     rtcPeerConnection.current = null;
  //     // createPeerConnection();
  //   }
  
  //   // Reset connection state and any related states
  //   setConnectionState('disconnected');
  //   setTrackReceived(false);

  //   const newRoomID = uuidv4().slice(0, 8);
  
  //   // Emit leave room event to the socket server if needed
  //   socket.emit('leave-room', roomId);
  //   setRoomId(newRoomID);
  //   socket.emit('join-room', newRoomID);
  // };
  const handleDisconnect = async () => {
    console.log("handleDisconnect called");
    // Close the existing RTC peer connection
    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.close();
    }
  
    // Reset connection state and related states
    setConnectionState('disconnected');
    setTrackReceived(false);
    // availableScreensRef.current = [];
    setScreensRecieved([]);
  
    // Generate a new room ID
    const newRoomID = uuidv4().slice(0, 8);
  
    // Emit leave room event to the socket server
    socket.emit('leave-room', roomId);
  
    // Set the new room ID
    setRoomId(newRoomID);
    videoRef.current!.srcObject = null;
    // Create a new peer connection
    rtcPeerConnection.current = createPeerConnection();
  
    // Create a new data channel
    dataChannel.current = rtcPeerConnection.current.createDataChannel("dataChannel");
    dataChannel.current.onopen = () => {
      console.log('Data channel is open');
    };
    dataChannel.current.onmessage = handleDataChannelMessage;
  
    // Join the new room
    socket.emit('join-room', newRoomID);
  };


  const handleScreenChange = (screen:screenType, roomId: string | null) => {
    console.log("Screen change emmited: ", screen, roomId);
    socket.emit("screen-change", screen, roomId);
    setSelectedScreen(screen.id);
  }
  



  return (
    <section className="flex flex-col justify-center items-center h-screen">
      
    {/* <img ref={imgRef}  alt="Alegra Labs" className="w-24 h-24" /> */}
    {
      connectionState === "failed" &&
      <div className='flex gap-4'>
        <p>Connection failed </p>
        <button onClick={()=>handleJoinRoom()} className='bg-indigo-500 hover:bg-indigo-700 text-white px-2 py-1 rounded-md mr-2'>
          Retry
        </button>
        <button onClick={()=>handleDisconnect()} className='bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded-md'>
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
      screensRecieved.length > 1 && connectionState === "connected" &&
      <div className="space-y-1">
        <h6 className='text-xs'>
          Select Screen
        </h6>
        <div className='flex gap-2'>
          {
            screensRecieved.map(screen => (
              <button key={screen.id} onClick={() => handleScreenChange(screen, roomId)} className={` ${selectedScreen === screen.id? "bg-indigo-600": "bg-indigo-400"}  hover:bg-indigo-800 text-white px-2 py-1 rounded-md`}>
                {screen.name}
              </button>
            ))
          }
        </div>
      </div>
    }
    {
    connectionState === "disconnected" && (

    loading? <div className="flex justify-center">
      <div className="animate-spin rounded-full h-28 w-28 border-8 border-dashed border-indigo-500"></div>
    </div> :
    <>
      <div className="flex justify-center items-center">
        {/* <img src={remote_desk_icon} alt="React Desk" className="w-28 h-28" /> */}
        <h1 className="text-2xl font-bold text-indigo-600 italic pb-8">Remote Desk</h1>
      </div>
      {
        isOnline?
        <span className="my-4 inline-flex items-center bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                <span className="w-2 h-2 me-1 bg-green-500 rounded-full"></span>
                online
      </span>
        :
      <span className="my-4 inline-flex items-center bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300">
                <span className="w-2 h-2 me-1 bg-red-500 rounded-full"></span>
                offline
      </span>
      }

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
            className={`focus:outline-none  text-indigo-600 focus:border-indigo-700 border-solid border-2 ${error? "border-red-400":"border-gray-400"} rounded-md px-2 py-1 bg-trasparent w-64 text-sm`}
          />
          <button onClick={()=> handleJoinRoom()} className='hover:bg-indigo-500 hover:border-indigo-500 bg-indigo-700 border-solid border-[2px] border-indigo-700 rounded-r-md px-2 py-1  absolute -right-1 top-0'>
             
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
       <div className='mt-4'>
        {error && <p className='text-red-500 text-xs'>{error}</p>}
       </div>
    </>  
    )        
    }

    {
      connectionState === "connecting" &&
      <div>
        Connecting...
      </div>
    }

{
      connectionState === "connected" && !trackReceived &&
      <div className='flex gap-4'>
        <h6>Connected, Your screen is being shared</h6>
        <button onClick={handleDisconnect}
                title='Disconnect'
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
        <>
      {
       connectionState === "connected" && trackReceived  && 
        <div className='flex justify-center gap-4 py-4'>
        {/* <label className="inline-flex items-center cursor-pointer ">
          <input
             type="checkbox"
             defaultValue=""
             checked={isChecked}
             onChange={handleToggle} 
             className="sr-only peer" />
          <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
          <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
            Show Cursor
          </span>
        </label> */}

        <button onClick={handleDisconnect}
          className=' bg-red-500 hover:bg-red-700 text-white text-sm px-2 py-1 rounded-md'>
          {/* <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="#fff"
          stroke="#fff"
          viewBox="0 0 1024 1024"
          className='w-5 h-5'
          >
          <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
          </svg>      */}
          Diconnect
        </button> 
        </div>
        } 
      
        <div className='relative'
          style={{display:`${ trackReceived ? "block" : "none"}`}}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleMouseScroll}
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
          onContextMenu={handleMouseClick}
          onKeyUp={handleKeyUp}
          tabIndex={0}>
          {/* { 
            connectionState === "connected" &&

          }    */}
          <video ref={videoRef} className="video cursor-none" style={{ width: "100%"}}>
            video not available
          </video>
        </div>
      </>
      }
    </section>
  );
};

export default Rtc;


