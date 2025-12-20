import { Route, Switch } from 'wouter'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from './components/ThemeProvider'
import Layout from './components/Layout'
import Home from './routes/Home'
import Halaqas from './routes/Halaqas'
import PostDetail from './routes/PostDetail'
import ParticipationSummary from './routes/ParticipationSummary'

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/halaqas" component={Halaqas} />
          <Route path="/students">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h1 className="text-2xl font-black text-foreground mb-2">الطالبات</h1>
                <p className="text-muted-foreground">قريباً...</p>
              </div>
            </div>
          </Route>
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
    </ThemeProvider>
  )
}
