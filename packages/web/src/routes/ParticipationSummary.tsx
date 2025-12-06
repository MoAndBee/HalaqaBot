import { useParams, useLocation } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/posts/${chatId}/${postId}`)}
          className="mb-2 sm:mb-3 md:mb-4 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          <span>رجوع</span>
        </Button>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
            ملخص المشاركة
          </h1>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground/80">
            {formattedDay}، {formattedDate}
          </h2>
          <div className="flex gap-3 text-xs sm:text-sm text-muted-foreground">
            <p>معرف المنشور: {postId}</p>
            <p>معرف المحادثة: {chatId}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>إحصائيات عامة</span>
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm font-normal text-muted-foreground">
                  عدد الحلقات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black">
                  {summary.sessionsCount.toLocaleString('ar-EG')}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm font-normal text-muted-foreground">
                  إجمالي الحضور
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black">
                  {summary.totalAttendance.toLocaleString('ar-EG')}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm font-normal text-muted-foreground">
                  نسبة المشاركة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black">
                  {summary.totalParticipations.toLocaleString('ar-EG')}
                  <span className="text-base sm:text-lg md:text-xl text-muted-foreground mr-2">
                    ({summary.participationRate.toLocaleString('ar-EG')}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>حسب نوع المشاركة</span>
          </h3>
          {(() => {
            const hasAnyData = sessionTypes.some(
              ({ key }) => summary.byType[key] && summary.byType[key].count > 0
            )

            if (!hasAnyData) {
              return (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      لا توجد مشاركات مكتملة حتى الآن
                    </p>
                  </CardContent>
                </Card>
              )
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sessionTypes.map(({ key }) => {
                  const typeData = summary.byType[key]

                  if (!typeData || typeData.count === 0) {
                    return null
                  }

                  return (
                    <Card key={key}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base sm:text-lg">
                          {typeData.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>✅</span>
                            <span>شاركن</span>
                          </span>
                          <span className="text-lg sm:text-xl font-bold">
                            {typeData.count.toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <button
                              className="flex items-center gap-2 bg-transparent border-none cursor-not-allowed opacity-50"
                              title="سيتم إضافة تقرير مفصل قريباً"
                              disabled
                            >
                              <span>ℹ️</span>
                              <span>لم يشاركن</span>
                            </button>
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-muted-foreground">
                            {typeData.nonParticipantCount.toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
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
