import { Route, Switch } from 'wouter'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from './components/ThemeProvider'
import { TelegramAuthProvider, useTelegramAuthContext } from './contexts/TelegramAuthContext'
import { LoadingScreen } from './components/LoadingScreen'
import { ErrorScreen } from './components/ErrorScreen'
import { UnauthorizedScreen } from './components/UnauthorizedScreen'
import Layout from './components/Layout'
import Home from './routes/Home'
import Halaqas from './routes/Halaqas'
import Students from './routes/Students'
import PostDetail from './routes/PostDetail'
import ParticipationSummary from './routes/ParticipationSummary'

function AppContent() {
  const { user, isAuthorized, isLoading, error } = useTelegramAuthContext()

  // Show loading while initializing
  if (isLoading) {
    return <LoadingScreen />
  }

  // Show error if something went wrong
  if (error) {
    return <ErrorScreen message={error} />
  }

  // Show unauthorized if user is not allowed
  if (!isAuthorized) {
    return <UnauthorizedScreen user={user} />
  }

  // User is authorized - show the app!
  return (
    <ThemeProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/halaqas" component={Halaqas} />
          <Route path="/students" component={Students} />
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

export default function App() {
  return (
    <TelegramAuthProvider>
      <AppContent />
    </TelegramAuthProvider>
  )
}
