import { Route, Switch } from 'wouter'
import { Toaster } from '@/components/ui/sonner'
import Layout from './components/Layout'
import Home from './routes/Home'
import PostDetail from './routes/PostDetail'
import ParticipationSummary from './routes/ParticipationSummary'

export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/posts/:chatId/:postId/summary" component={ParticipationSummary} />
        <Route path="/posts/:chatId/:postId" component={PostDetail} />
        <Route>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-4xl font-black text-foreground mb-2">404</h1>
              <p className="text-muted-foreground">الصفحة غير موجودة</p>
            </div>
          </div>
        </Route>
      </Switch>
      <Toaster position="top-center" dir="rtl" />
    </Layout>
  )
}
