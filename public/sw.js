// Service Worker básico para PWA com Push Notifications
const CACHE_NAME = 'footscore-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Instalar service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Ativar imediatamente
  )
})

// Ativar service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
    .then(() => self.clients.claim()) // Controlar todas as páginas imediatamente
  )
})

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Não interceptar requisições SSE (Server-Sent Events)
  // EventSource requer conexão persistente que o Service Worker não pode manter
  const isSSERequest = url.pathname.includes('/api/matches/events') || 
                       url.pathname.includes('/events') ||
                       event.request.headers.get('Accept') === 'text/event-stream' ||
                       event.request.headers.get('Accept')?.includes('text/event-stream')
  
  if (isSSERequest) {
    // Deixar passar direto para a rede, sem interceptação
    // Não chamar event.respondWith() permite que a requisição passe direto
    return
  }
  
  // Não interceptar requisições para a API (deixar passar direto)
  if (url.pathname.startsWith('/api/')) {
    return
  }
  
  // Apenas interceptar requisições GET para recursos estáticos
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Retornar do cache ou buscar da rede
          return response || fetch(event.request)
        })
    )
  }
  // Para outros métodos (POST, PUT, etc), deixar passar direto
})

// Enviar mensagem para o cliente quando ativado
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker ativado')
  event.waitUntil(self.clients.claim())
})

// Escutar eventos de push (notificações)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event recebido - INÍCIO')
  console.log('[SW] Event data:', event.data)

  let notificationData = {
    title: '⚽ Gol!',
    body: 'Um gol foi marcado!',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'goal-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {}
  }

  console.log('[SW] Notification data inicial:', notificationData)

  // Tentar parsear dados do push
  if (event.data) {
    try {
      console.log('[SW] Tentando parsear dados...')
      const data = event.data.json()
      console.log('[SW] Dados parseados:', JSON.stringify(data, null, 2))

      if (data.type === 'score_update' && data.data?.scoreChanged) {
        console.log('[SW] Score changed detectado - criando notificação personalizada')
        const goalScorer = data.data.goalScorer
        const homeTeam = data.data.homeTeam
        const awayTeam = data.data.awayTeam
        const homeScore = data.data.homeScore
        const awayScore = data.data.awayScore

        if (goalScorer === 'home') {
          notificationData.title = `⚽ Gol do ${homeTeam}!`
          notificationData.body = `${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`
        } else if (goalScorer === 'away') {
          notificationData.title = `⚽ Gol do ${awayTeam}!`
          notificationData.body = `${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`
        } else {
          notificationData.title = '⚽ Gol!'
          notificationData.body = `${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`
        }

        notificationData.data = {
          type: 'goal',
          matchId: data.data.matchId,
          round: data.data.round,
          url: '/ranking'
        }

        console.log('[SW] Notificação personalizada criada:', {
          title: notificationData.title,
          body: notificationData.body
        })
      } else {
        console.log('[SW] Não é score_update válido:', {
          type: data.type,
          scoreChanged: data.data?.scoreChanged
        })
        // Usar notificação genérica
        notificationData.title = '⚽ Atualização de Jogo!'
        notificationData.body = 'Houve uma mudança no placar'
      }
    } catch (e) {
      console.error('[SW] Erro ao parsear dados do push:', e)
      console.error('[SW] Dados brutos recebidos:', event.data)
      // Usar dados padrão
      notificationData.title = '⚽ Notificação!'
      notificationData.body = 'Recebida do servidor'
    }
  } else {
    console.log('[SW] Nenhum dado no push event - usando notificação padrão')
  }

  console.log('[SW] Final notification data:', notificationData)
  console.log('[SW] Tentando mostrar notificação...')

  try {
    const result = self.registration.showNotification(notificationData.title, notificationData)
    console.log('[SW] showNotification chamado com sucesso - FIM DO PUSH HANDLER')
    event.waitUntil(result)
  } catch (error) {
    console.error('[SW] ERRO CRÍTICO ao chamar showNotification:', error)
    console.error('[SW] Mensagem:', error.message)
    console.error('[SW] Stack:', error.stack)
  }
})

// Escutar cliques em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event)
  
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Se já existe uma janela aberta, focar nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // Se não, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

