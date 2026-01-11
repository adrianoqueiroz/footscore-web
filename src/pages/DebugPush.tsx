import { useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function DebugPush() {
  const [testResult, setTestResult] = useState('')
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe
  } = usePushNotifications()

  const testNotificationAPI = async () => {
    setTestResult('Testing Notification API...')

    try {
      if (Notification.permission !== 'granted') {
        setTestResult('❌ Notification permission not granted')
        return
      }

      const notification = new Notification('Test Direct API', {
        body: 'This is a direct Notification API test',
        icon: '/vite.svg',
        tag: 'debug-test'
      })

      setTestResult('✅ Direct Notification API works!')
    } catch (error: any) {
      setTestResult(`❌ Direct Notification API failed: ${error.message}`)
    }
  }

  const testServiceWorkerNotification = async () => {
    setTestResult('Testing Service Worker Notification...')

    try {
      if (!('serviceWorker' in navigator)) {
        setTestResult('❌ Service Worker not supported')
        return
      }

      const registration = await navigator.serviceWorker.ready

      await registration.showNotification('Test SW API', {
        body: 'This is a Service Worker notification test',
        icon: '/vite.svg',
        tag: 'sw-debug-test'
      })

      setTestResult('✅ Service Worker notification works!')
    } catch (error: any) {
      setTestResult(`❌ Service Worker notification failed: ${error.message}`)
    }
  }

  const testPushSubscription = async () => {
    setTestResult('Testing Push Subscription...')

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setTestResult('❌ Push not supported')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        setTestResult(`✅ Push subscription exists: ${subscription.endpoint.substring(0, 40)}...`)
      } else {
        setTestResult('❌ No push subscription found')
      }
    } catch (error: any) {
      setTestResult(`❌ Push subscription test failed: ${error.message}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Push Notifications Debug</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Status</h2>
          <div className="space-y-1 text-sm">
            <div>Supported: {isSupported ? '✅' : '❌'}</div>
            <div>Permission: {permission}</div>
            <div>Subscribed: {isSubscribed ? '✅' : '❌'}</div>
            <div>Loading: {isLoading ? '⏳' : '✅'}</div>
            <div>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'}</div>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Actions</h2>
          <div className="space-y-2">
            <button
              onClick={requestPermission}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm"
              disabled={isLoading}
            >
              Request Permission
            </button>

            <button
              onClick={subscribe}
              className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm"
              disabled={isLoading || !isSupported || permission !== 'granted'}
            >
              Subscribe to Push
            </button>

            <button
              onClick={unsubscribe}
              className="w-full px-3 py-2 bg-red-500 text-white rounded text-sm"
              disabled={isLoading || !isSupported}
            >
              Unsubscribe
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border rounded-lg">
        <h2 className="font-semibold mb-2">Tests</h2>
        <div className="space-y-2">
          <button
            onClick={testNotificationAPI}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm"
          >
            Test Direct Notification API
          </button>

          <button
            onClick={testServiceWorkerNotification}
            className="w-full px-3 py-2 bg-orange-500 text-white rounded text-sm"
          >
            Test Service Worker Notification
          </button>

          <button
            onClick={testPushSubscription}
            className="w-full px-3 py-2 bg-teal-500 text-white rounded text-sm"
          >
            Test Push Subscription
          </button>
        </div>
      </div>

      {testResult && (
        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Test Result</h2>
          <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}

      <div className="p-4 border rounded-lg">
        <h2 className="font-semibold mb-2">Instructions</h2>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>Open browser console (F12)</li>
          <li>Click "Request Permission" if needed</li>
          <li>Click "Subscribe to Push"</li>
          <li>Go to admin and make a goal</li>
          <li>Check console for push events</li>
          <li>Check if notification appears</li>
        </ol>
      </div>
    </div>
  )
}