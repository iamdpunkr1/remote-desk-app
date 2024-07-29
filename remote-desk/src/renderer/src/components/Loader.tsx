
const Loader = () => {
  return (
    <div className="flex flex-col justify-center gap-2 items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-dashed border-indigo-500"></div>
      <p className="text-white text-xl">Connecting...</p>
    </div>
  )
}

export default Loader