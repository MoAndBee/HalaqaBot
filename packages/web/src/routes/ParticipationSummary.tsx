import { Link, useParams, useLocation } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from '~/components/Loader'

export default function ParticipationSummary() {
  const params = useParams<{ chatId: string; postId: string }>()
  const [, navigate] = useLocation()
  const chatId = Number(params.chatId)
  const postId = Number(params.postId)

  const summary = useQuery(api.queries.getParticipationSummary, { chatId, postId })
  const postDetails = useQuery(api.queries.getPostDetails, { chatId, postId })

  if (summary === undefined || postDetails === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  const date = new Date(postDetails.createdAt)
  const formattedDate = date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedDay = date.toLocaleDateString('ar-EG', {
    weekday: 'long',
  })

  const sessionTypes = [
    { key: 'tilawa', label: 'تلاوة' },
    { key: 'tasmee', label: 'تسميع' },
    { key: 'tatbeeq', label: 'تطبيق' },
    { key: 'ikhtebar', label: 'اختبار' },
  ]

  return (
    <div className="p-3 sm:p-6 md:p-8 h-full flex flex-col">
      <div className="mb-3 sm:mb-4 md:mb-6">
        <button
          onClick={() => navigate(`/posts/${chatId}/${postId}`)}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-2 sm:mb-3 md:mb-4 bg-transparent border-none cursor-pointer"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span className="text-sm sm:text-base">رجوع</span>
        </button>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            ملخص المشاركة
          </h1>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-slate-200">
            {formattedDay}، {formattedDate}
          </h2>
          <div className="flex gap-3 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            <p>معرف المنشور: {postId}</p>
            <p>معرف المحادثة: {chatId}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {/* Overall Stats Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>إحصائيات عامة</span>
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-2">
                عدد الحلقات
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                {summary.sessionsCount.toLocaleString('ar-EG')}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-2">
                إجمالي الحضور
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                {summary.totalAttendance.toLocaleString('ar-EG')}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-2">
                إجمالي المشاركات
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                {summary.totalParticipations.toLocaleString('ar-EG')}
                <span className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-slate-400 mr-2">
                  ({summary.participationRate.toLocaleString('ar-EG')}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* By Participation Type Section */}
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>حسب نوع المشاركة</span>
          </h3>
          {(() => {
            const hasAnyData = sessionTypes.some(
              ({ key }) => summary.byType[key] && summary.byType[key].count > 0
            )

            if (!hasAnyData) {
              return (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
                  <p className="text-gray-600 dark:text-slate-400">
                    لا توجد مشاركات مكتملة حتى الآن
                  </p>
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sessionTypes.map(({ key }) => {
                  const typeData = summary.byType[key]

                  // Hide types with 0 participations
                  if (!typeData || typeData.count === 0) {
                    return null
                  }

                  return (
                    <div
                      key={key}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-6"
                    >
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">
                        {typeData.label}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                            <span>✅</span>
                            <span>شاركوا</span>
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                            {typeData.count.toLocaleString('ar-EG')} مشاركة
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                            <button
                              className="flex items-center gap-2 bg-transparent border-none cursor-not-allowed opacity-50"
                              title="سيتم إضافة تقرير مفصل قريباً"
                              disabled
                            >
                              <span>ℹ️</span>
                              <span>لم يشاركوا</span>
                            </button>
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-gray-600 dark:text-slate-400">
                            {typeData.nonParticipantCount.toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
