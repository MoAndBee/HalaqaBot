import type { Channel } from '../contexts/TelegramAuthContext'

interface ChannelPickerProps {
  channels: Channel[]
  onSelect: (channel: Channel) => void
}

export function ChannelPicker({ channels, onSelect }: ChannelPickerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">اختر القناة</h1>
          <p className="text-gray-600">
            لديك صلاحيات في أكثر من قناة، اختر القناة التي تريد إدارتها
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {channels.map((channel) => (
            <button
              key={channel.channelId}
              onClick={() => onSelect(channel)}
              className="text-right bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-4 transition-colors w-full"
            >
              <p className="font-semibold text-gray-900">
                {channel.title || `قناة ${channel.channelId}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">معرف: {channel.channelId}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
