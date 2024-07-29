
type FailedViewProps = {
    handleJoinRoom: () => void
    handleDisconnect: () => void
    }

const FailedView = ({handleJoinRoom, handleDisconnect}:FailedViewProps) => {
  return (
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
  )
}

export default FailedView