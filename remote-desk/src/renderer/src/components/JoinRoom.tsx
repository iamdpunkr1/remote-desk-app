import { useRoom } from "@renderer/context/RoomContext";
import { useState } from "react";

type JoinRoomProps = {
    isOnline: boolean,
    error: string | null,
    handleJoinRoom: (joinRoomId:string) => void
    }



const JoinRoom = ({isOnline, error, handleJoinRoom}:JoinRoomProps) => {

  const { roomId } = useRoom();
  const [joinRoomId, setJoinRoomId] = useState<string>('');

    const handleCopyRoomId = () => {
        if (roomId) {
          navigator.clipboard.writeText(roomId).then(() => {
            console.log("Room ID copied to clipboard");
          }).catch(err => {
            console.error("Failed to copy Room ID: ", err);
          });
        }
      };

      

  return (
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
        <button onClick={()=> handleJoinRoom(joinRoomId)} className='hover:bg-indigo-500 hover:border-indigo-500 bg-indigo-700 border-solid border-[2px] border-indigo-700 rounded-r-md px-2 py-1  absolute -right-1 top-0'>
           
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

export default JoinRoom