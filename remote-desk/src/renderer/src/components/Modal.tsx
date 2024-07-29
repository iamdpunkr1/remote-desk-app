type ModalProps = {
    requesterId:string,
    handleModalResponse:(response:boolean)=>void
}


const Modal = ({requesterId, handleModalResponse}:ModalProps) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
    <div className="bg-gray-800 rounded-lg p-6 space-y-4 shadow-xl w-8/12">
      <p className="text-md font-semibold text-white text-center">{`A screen share request has come from "${requesterId}". Do you want to share your screen?`}</p>
      <div className="flex justify-center gap-4 pt-8">
        <button onClick={() => handleModalResponse(true)} className="bg-indigo-500 hover:bg-indigo-700 text-white px-4 py-2 rounded-md">
          Accept
        </button>
        <button onClick={() => handleModalResponse(false)} className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-md">
          Deny
        </button>
      </div>
    </div>
  </div>
  )
}

export default Modal