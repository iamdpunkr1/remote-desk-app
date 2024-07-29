import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from "socket.io-client";
import { useRoom } from './context/RoomContext';
import './App.css';
import { v4 as uuidv4 } from 'uuid';
import Modal from './components/Modal';
import ConnectedView from './components/ConnectedView';
import Loader from './components/Loader';
import FailedView from './components/FailedView';
import JoinRoom from './components/JoinRoom';


type screenType = {
  id:string,
  name:string,
  display_id:string
}

type RequesterType = {
  id:string,
  hostName:string 
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
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const joinedRoomId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<boolean>(false);
  const [requester, setRequester] = useState<RequesterType>({id:"", hostName:""});
  const [hostName, setHostName] = useState<string>('');
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
     // console.log(e);
    }
  };


  const handleTrack = (e: RTCTrackEvent) => {
   // console.log('Track received:', e.streams[0]);

    if(e.streams[0]){
      setTrackReceived(true);
    }
    if (videoRef.current) {
    //  console.log('Track received:', e.streams[0]);
      videoRef.current.srcObject = e.streams[0];
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
     //   console.log("Video playing");
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

    });
  
    newPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
       // console.log('ICE Candidate emit:', roomId, event.candidate);
          socket.emit('icecandidate', JSON.stringify(event.candidate), roomId);

      }
    };
  
    newPeerConnection.ontrack = handleTrack;
  
    newPeerConnection.onconnectionstatechange = () => {
      setConnectionState(newPeerConnection.connectionState);
     // console.log('ICE connection state:', newPeerConnection.iceConnectionState);
      if (newPeerConnection.iceConnectionState === 'failed') {
        setTrackReceived(false)
        // Trigger ICE restart
        // newPeerConnection.restartIce();
      }
    };
  
    newPeerConnection.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      dataChannel.current.onmessage = handleDataChannelMessage;
    };
  
    return newPeerConnection;
  };




  const handleAppClosing = () => {
    console.log("App closing event received");
    const hasActiveConnection = videoRef.current?.srcObject !== null;
    window.electronAPI.sendConfirmQuit(hasActiveConnection);
  };

  const handleForcedDisconnect = async () => {
 
    // await handleDisconnect();
    //console.log("Forced disconnect event received: ", joinedRoomId.current);
    socket.emit('leave-room', joinedRoomId.current);
    setTimeout(() => {
      window.electronAPI.sendQuitApp();
    }, 1000);
    // window.electronAPI.sendQuitApp();
  };

  const handleModalResponse = (accepted:boolean) => {
    if(accepted){
      setConnectionState("connecting");
     // console.log("Accepted Room id: ", roomId)
      joinedRoomId.current=roomId;
    } 

    socket.emit('screen-share-response', roomId, accepted, requester.id);
    
    setModal(false);
  };

  const attemptWebRTCConnection = (roomId: string, socketId: string, attemptCount: number = 0) => {
    if (attemptCount >= 3) {
      // console.log("Failed to establish WebRTC connection after 3 attempts");
      setError("Failed to establish connection. Please try again.");
      setLoading(false);
      const newRoomID = uuidv4().slice(0, 8);
      setRoomId(newRoomID);
      joinedRoomId.current=null;
      socket.emit("join-room", newRoomID);
      return;
    }
  
    //console.log(`Attempt ${attemptCount + 1} to establish WebRTC connection: ${roomId}`);
    joinedRoomId.current=roomId;
    setRoomId(roomId);
    // setIsInitiator(true);
    socket.emit("join-room", roomId, socketId);
  
  
    // Set a timeout to check if the connection was established
    setTimeout(() => {
      if (rtcPeerConnection.current?.connectionState !== 'connected') {
        //console.log(`Attempt ${attemptCount + 1} failed. Retrying...`);
        attemptWebRTCConnection(roomId, socketId, attemptCount + 1);
      } else {
        //console.log("WebRTC connection established successfully");
      }
    }, 5000); // Wait for 5 seconds before checking the connection state
  };
  
  useEffect(()=> console.log("ROOM ID: ", roomId),[roomId])

  useEffect(() => {
 
    window.electronAPI.getHostName((_, hostName) => {
      console.log("Host Name: ", hostName);
      setHostName(hostName);
    });
    rtcPeerConnection.current = createPeerConnection();

      // Listen for app closing event
    window.electronAPI.onAppClosing(handleAppClosing);

    // Listen for disconnect request
    window.electronAPI.onPerformDisconnect(handleForcedDisconnect);

    // Listen for quit cancelled event
    // window.electronAPI.onQuitCancelled(() => setIsQuitting(false));

    // console.log("SUpported Constraints: ",navigator.mediaDevices.getSupportedConstraints())

    if(rtcPeerConnection.current){
      //console.log("Data Channel created");
      dataChannel.current = rtcPeerConnection.current.createDataChannel("dataChannel");
      dataChannel.current.onopen = () => {
       // console.log('Data channel is open');
      };

      dataChannel.current.onmessage = handleDataChannelMessage;
    }

    socket.on("connect", () => {
      //console.log("Connected to server");
      socket.emit("join-room", roomId);
      socket.emit("electron-app", "Hello from Electron App");
      setIsOnline(true);
    });

    socket.on("disconnect", () => {
      //console.log("Disconnected from server");
      setIsOnline(false);
    });

    socket.on("reconnect", () => {
      //console.log("Reconnected to server");
      setIsOnline(true);
    });

    socket.on("reconnect_error", () => {
      //console.log("Reconnect error");
      setIsOnline(false);

    });

    socket.on("connect_error", () => {
      //console.log("Connect error");
      setIsOnline(false);
    });

    
  

    // Listen for available screens from the main process
    window.electronAPI.getAvailableScreens((_, screens) => {
     // console.log('Available screens: ', screens.length);
      //console.log("Room ID:", roomId);
     // console.log("Connection State:", connectionState);

      availableScreensRef.current = screens;
      setSelectedScreen(screens[0].id);
      if(screens.length > 0 && roomId){
        console.log("Available screens emitted to SOCKET: ", screens);
         socket.emit("available-screens", screens, joinedRoomId.current);
      }
    });

    socket.on("room-not-found", (_) => {
     // console.log("Room not found: ", roomId);
      setError("Remote PC not found");
      joinedRoomId.current = null;
      setLoading(false);

    });

    socket.on("screen-share-request", (requesterId, hostName) => {
     // console.log("Screen share request received: ", requesterId, hostName);
      setModal(true);
      setRequester({id:requesterId, hostName});
    });

    
    socket.on("screen-share-accepted", async (roomId, socketId)=>{
      
     // console.log("Screen share accepted: ", roomId, joinedRoomId.current);
      attemptWebRTCConnection(roomId, socketId);
    })

    socket.on("get-offer", (roomId) => {
     // console.log("Get screen called");
      if (availableScreensRef.current.length > 0) {
       // console.log("screen id: ", availableScreensRef.current[0].id);
        getStream(availableScreensRef.current[0].id, roomId); 
      } else {
        //console.log("No available screens");
      }
    });


    socket.on("screen-share-denied", () => {
      console.log("Screen share denied");
      // Generate a new room ID
      // const newRoomID = uuidv4().slice(0, 8);
      // setRoomId(newRoomID);
      setError("Screen share denied");
      setLoading(false);
    });


    socket.on("offer", async (sdp: string, roomId:string) => {
     // console.log('Offer received:', sdp);
      const offer = new RTCSessionDescription(JSON.parse(sdp));
      rtcPeerConnection.current?.setRemoteDescription(offer)
        .then(() => rtcPeerConnection.current?.createAnswer())
        .then(answer => {
          rtcPeerConnection.current?.setLocalDescription(answer);
          socket.emit("answer", JSON.stringify(answer), roomId);
        });

    });

    socket.on("answer", (sdp: string) => {
     // console.log('Answer received:', sdp);
      const answer = new RTCSessionDescription(JSON.parse(sdp));
      rtcPeerConnection.current?.setRemoteDescription(answer);
      //console.log("Screens: ", availableScreensRef.current);
      if(availableScreensRef.current.length > 1){
     // console.log("Available screens emitted to SOCKET: ", availableScreensRef.current);
      socket.emit("available-screens", availableScreensRef.current, joinedRoomId.current);
      }
    });

    socket.on("available-screens", (screens: screenType[]) => {
     // console.log('Screens recieved: ', screens);
      setScreensRecieved(screens);

    } );



    socket.on('icecandidate', (candidate: string) => {
      //console.log('ICE Candidate received:', candidate);
      const iceCandidate = new RTCIceCandidate(JSON.parse(candidate));
      rtcPeerConnection.current?.addIceCandidate(iceCandidate)
       .catch(e => console.error('Error adding received ice candidate', e));
    });


    socket.on("screen-change", (screen: screenType) => {
    //  console.log('Screen change:', screen);
      if(roomId){
        getStream(screen.id, roomId);
        window.electronAPI.sendScreenChange(screen.display_id);
      }
    });



    socket.on("user-left", () => {
    //  console.log("User left");
      handleDisconnect();
    });

    return () => {

      socket.close();
      
      rtcPeerConnection.current?.removeEventListener("track", handleTrack);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []); 



  
  
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
     // console.log("video Rect: ", videoRects)
      setVideoRects(videoRef.current.getBoundingClientRect()); // Initialize videoRects
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
 


  const handleMouseScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if(connectionState === "connected"){
      const { deltaX, deltaY } = e;
      
     // console.log("Mouse Scroll", deltaX, deltaY);
      // Emit scroll data to server via Socket.io
    //   socket.emit("mouse-scroll", { deltaX, deltaY }, roomId);
        if(dataChannel.current){
           // console.log("mouse scroll sent via RTC: ");
            dataChannel.current.send(JSON.stringify({
                type: 'mouse-scroll',
                payload: { deltaX, deltaY }
            }));
        }
    }
  }


  const handleMouseDown = (_: React.MouseEvent<HTMLDivElement>) => {
    if(dataChannel.current){
    //  console.log("mouse down sent via RTC: ");
      dataChannel.current.send(JSON.stringify({
          type: 'mouse-down',
          payload: true
        }));
  }
  }

  const handleMouseUp = (_: React.MouseEvent<HTMLDivElement>) => {
    if(dataChannel.current){
    //  console.log("mouse up sent via RTC: ");
      dataChannel.current.send(JSON.stringify({
          type: 'mouse-up',
          payload: true
        }));
  }
  }


  
  const handleJoinRoom = async (joinRoomId:string = "") => {
   // console.log("Join room called: ", joinRoomId, roomId);
    if (joinRoomId.trim() === roomId) {
      setError("You can't join your own room");
      joinedRoomId.current = null;
      return;
    }

    if(!isOnline){
       setError("You are offline, connect to the internet");
       return;
    }

    setError(null);
    setLoading(true);

    if(!joinedRoomId.current)
       joinedRoomId.current = joinRoomId;

    if (joinedRoomId.current.trim()) {
      try {
        socket.emit("request-screen-share", joinedRoomId.current, hostName);
        // setRoomId(joinedRoomId.current);
      } catch (error) {
       // console.log('Connection error:', error);
      }
    }
    setJoinRoomId('');
  };
  

  const handleDisconnect = async () => {
   // console.log("handleDisconnect called: ",  joinedRoomId.current);
    
    // Close the existing RTC peer connection
    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.onicecandidate = null;
      rtcPeerConnection.current.ontrack = null;
      rtcPeerConnection.current.onconnectionstatechange = null;
      rtcPeerConnection.current.ondatachannel = null;
      rtcPeerConnection.current.close();
      rtcPeerConnection.current = null;
    }

    // Reset connection state and related states
    setConnectionState('disconnected');
    setTrackReceived(false);
    setScreensRecieved([]);
    setJoinRoomId('');
    videoRef.current!.srcObject = null;
    
    // Emit leave room event to the socket server
    socket.emit('leave-room', joinedRoomId.current);
    
    // Generate a new room ID
    const newRoomID = uuidv4().slice(0, 8);
    setRoomId(newRoomID);
    joinedRoomId.current = null;
    

    // Create a new peer connection
    rtcPeerConnection.current = createPeerConnection();

    // Create a new data channel
    dataChannel.current = rtcPeerConnection.current.createDataChannel("dataChannel");
    dataChannel.current.onopen = () => {
     // console.log('Data channel is open');
    };
    dataChannel.current.onmessage = handleDataChannelMessage;

    // Join the new room
    socket.emit('join-room', newRoomID);
};


  const handleScreenChange = (screen:screenType, _: string | null) => {
   // console.log("Screen change emmited: ", screen, joinedRoomId.current);
    socket.emit("screen-change", screen, joinedRoomId.current);
    setSelectedScreen(screen.id);
  }
  





  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connectionState === "connected" && videoRef.current && videoRects) {
      // console.log("Mouse move called");
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
      //  console.log("mouse click sent via RTC: ");
        if(dataChannel.current){
         //   console.log("mouse move sent via RTC: ");
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
     // console.log("Modifers:  ", modifier);

    //   socket.emit("key-up",{ key: e.key, code: modifier }, roomId);

      if(dataChannel.current){
     //   console.log("key up sent via RTC: ");
        dataChannel.current.send(JSON.stringify({
            type: 'key-up',
            payload: { key: e.key, code: modifier }
          }));
      }
    }
  };




  return (
    <section className="flex flex-col justify-center items-center h-screen">
    {
      connectionState === "failed" &&
      <FailedView handleDisconnect={handleDisconnect} handleJoinRoom={handleJoinRoom}/>
    }
 
    {
    connectionState === "disconnected" && (

    loading? 
    <Loader/>
    :
    <JoinRoom isOnline={isOnline} error={error} handleJoinRoom={handleJoinRoom}/>
    )        
    }


    <div className='flex flex-col'>
   {
      <>
      {
       connectionState === "connected" && trackReceived  && 
        <div className='flex justify-between w-full lg:w-10/12 items-center pb-4 px-1 lg:px-0 h-2/12 mx-auto'>
          
          {
            screensRecieved.length > 1 &&
            (<div className="space-y-1">
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
            </div>)
          }


        <button onClick={handleDisconnect}
          className=' bg-red-500 hover:bg-red-700 text-white text-sm px-2 py-1 rounded-md'>
          Diconnect
        </button> 
        </div>
        } 

      
        <div className="h-10/12"
          style={{display:`${ trackReceived ? "block" : "none"}`}}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleMouseScroll}
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
          onContextMenu={handleMouseClick}
          onKeyUp={handleKeyUp}
          tabIndex={0}>
          <video ref={videoRef} className="video cursor-none sm:w-full md:w-full lg:w-10/12 mx-auto" >
            video not available
          </video>
        </div>
      </>
      }
    </div>
    {
      connectionState === "connecting" &&
      <Loader/>
    }

    {connectionState === "connected" && !trackReceived && (
        <ConnectedView handleDisconnect={handleDisconnect} />
      )}

    {modal && <Modal requesterId={requester.hostName} handleModalResponse={handleModalResponse}/>}
    </section>
  );
};

export default Rtc;