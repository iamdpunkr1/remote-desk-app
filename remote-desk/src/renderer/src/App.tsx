import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from "socket.io-client";

declare global {
  interface Window {
    electronAPI: {
      getScreenId: (callback: (event: any, screenId: string) => void) => void;
      setSize: ({ width, height }: { width: number; height: number }) => void;
    };
  }
}

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socket = useMemo(() => io("http://localhost:5000/remote-ctrl"), []);
  const [availableScreens, setAvailableScreens] = useState<{ id: string, name: string }[]>([]);

  const rtcPeerConnection = useRef<RTCPeerConnection | null>(new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
  }) as RTCPeerConnection);

  const handleStream = (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      stream.getTracks().forEach(track => {
        rtcPeerConnection.current?.addTrack(track, stream);
      });
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }
  };

  const getStream = async (screenId: string) => {
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

      handleStream(stream);
      // Notify the peer about the screen change
      rtcPeerConnection.current?.createOffer({
        offerToReceiveVideo: true,
      }).then(sdp => {
        rtcPeerConnection.current?.setLocalDescription(sdp);
        socket.emit("offer", JSON.stringify(sdp));
      });
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.emit("electron-app", "Hello from Electron App");

    window.electronAPI.getScreenId((_, screenId) => {
      console.log('Renderer...', screenId);
      getStream(screenId);
    });

    // Listen for available screens from the main process
    window.electronAPI.getAvailableScreens((_, screens) => {
      setAvailableScreens(screens);
    });

    socket.on("offer", async (sdp: string) => {
      console.log('Offer received:', sdp);
      const offer = new RTCSessionDescription(JSON.parse(sdp));
      rtcPeerConnection.current?.setRemoteDescription(offer)
        .then(() => rtcPeerConnection.current?.createAnswer())
        .then(answer => {
          rtcPeerConnection.current?.setLocalDescription(answer);
          socket.emit("answer", JSON.stringify(answer));
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

    if (rtcPeerConnection.current) {
      rtcPeerConnection.current.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('ICE Candidate:', JSON.stringify(e.candidate));
          socket.emit('icecandidate', JSON.stringify(e.candidate));
        }
      };

      rtcPeerConnection.current.onconnectionstatechange = (e) => {
        console.log('Connection state', rtcPeerConnection.current?.connectionState);
      };
    }

    return () => {
      socket.close();
    };
  }, []);

  const switchScreen = (screenId: string) => {
    getStream(screenId);
  };

  return (
    <div className="App">
      <div>
        {availableScreens.map(screen => (
          <button key={screen.id} onClick={() => switchScreen(screen.id)}>
            {screen.name}
          </button>
        ))}
      </div>
      <video ref={videoRef} className="video" style={{ maxWidth: "100%" }}>video not available</video>
    </div>
  );
};

export default App;
