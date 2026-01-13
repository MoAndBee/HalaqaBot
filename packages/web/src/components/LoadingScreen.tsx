export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6" />
      <p className="text-gray-600 text-lg font-medium">جاري التحميل...</p>
    </div>
  )
}
