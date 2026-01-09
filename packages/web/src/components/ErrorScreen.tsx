interface ErrorScreenProps {
  message: string
  onClose?: () => void
}

export function ErrorScreen({ message, onClose }: ErrorScreenProps) {
  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      window.Telegram?.WebApp.close()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">خطأ</h1>
          <p className="text-gray-700 mb-6 leading-relaxed">{message}</p>
        </div>

        <button
          onClick={handleClose}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full font-medium"
        >
          إغلاق
        </button>
      </div>
    </div>
  )
}
