// Service Worker básico para PWA com Push Notifications
const CACHE_NAME = 'footscore-v1.0.1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.jpg',
  '/icon-512x512.jpg',
  '/apple-touch-icon.png'
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

  // Não interceptar rotas do React Router (SPA routes)
  // Qualquer rota que não seja arquivo com extensão é provavelmente uma rota do React
  const hasExtension = url.pathname.includes('.')
  if (!hasExtension && url.pathname !== '/' && url.pathname !== '/index.html') {
    // Deixar o navegador/servidor lidar com rotas SPA
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
  console.log('[SW] 📨 ===== PUSH EVENT RECEIVED =====')
  console.log('[SW] 📨 Timestamp:', new Date().toISOString())
  console.log('[SW] 📨 User Agent:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other')
  console.log('[SW] 📨 Data:', event.data ? event.data.text() : 'null')
  console.log('[SW] 📨 Event properties:', Object.keys(event))
  console.log('[SW] 📨 User visible only:', event.data ? 'yes' : 'no')

  let notificationData = {
    title: '🔔 Notificação',
    body: 'Nova notificação',
    icon: '/icon-192x192.jpg',
    badge: '/icon-192x192.jpg',
    tag: 'notification',
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
        notificationData.tag = `goal-${data.data.matchId}-${Date.now()}`
      } else if (data.type === 'round_bets_status') {
        console.log('[SW] Round bets status detectado - criando notificação')
        const { round, allowsNewBets, isBlocked } = data.data || {}
        
        if (allowsNewBets) {
          notificationData.title = '✅ Rodada Aceitando Palpites!'
          notificationData.body = `A rodada ${round} está aceitando palpites agora!`
        } else {
          notificationData.title = '🔒 Rodada Bloqueada!'
          notificationData.body = isBlocked 
            ? `A rodada ${round} foi bloqueada automaticamente (30 min antes do primeiro jogo)`
            : `A rodada ${round} não está mais aceitando palpites`
        }

        notificationData.data = {
          type: 'round_bets_status',
          round,
          allowsNewBets,
          isBlocked,
          url: '/predictions'
        }
        notificationData.tag = `round-bets-${round}`
      } else if (data.type === 'ranking_winner') {
        console.log('[SW] Ranking winner detectado - criando notificação')
        const { round, ticketId, position, points } = data.data || {}
        
        notificationData.title = '🏆 Você é o Vencedor!'
        notificationData.body = `Parabéns! Seu ticket está em 1º lugar na rodada ${round} com ${points} pontos!`
        notificationData.requireInteraction = true
        notificationData.vibrate = [200, 100, 200, 100, 200]

        notificationData.data = {
          type: 'ranking_winner',
          round,
          ticketId,
          position,
          points,
          url: '/ranking'
        }
        notificationData.tag = `ranking-winner-${round}-${ticketId}`
      } else if (data.type === 'ranking_top_n') {
        console.log('[SW] Ranking top N detectado - criando notificação')
        const { round, ticketId, position, points, topN } = data.data || {}
        
        notificationData.title = `🎯 Você está no Top ${topN || 3}!`
        notificationData.body = `Seu ticket está em ${position}º lugar na rodada ${round} com ${points} pontos!`
        notificationData.vibrate = [200, 100, 200]

        notificationData.data = {
          type: 'ranking_top_n',
          round,
          ticketId,
          position,
          points,
          topN,
          url: '/ranking'
        }
        notificationData.tag = `ranking-top-${round}-${ticketId}`
      } else {
        console.log('[SW] Tipo de notificação desconhecido:', data.type)
        // Usar notificação genérica
        notificationData.title = data.title || '🔔 Notificação'
        notificationData.body = data.body || 'Nova notificação'
        notificationData.data = data.data || {}
      }
    } catch (e) {
      console.error('[SW] Erro ao parsear dados do push:', e)
      console.error('[SW] Dados brutos recebidos:', event.data)
      // Usar dados padrão
      notificationData.title = '🔔 Notificação!'
      notificationData.body = 'Recebida do servidor'
    }
  } else {
    console.log('[SW] Nenhum dado no push event - usando notificação padrão')
  }

  // Verificar se há clientes (janelas) visíveis antes de mostrar a notificação push
  // Se o app estiver aberto e visível, ele já receberá a notificação interna via SSE
  // Então não precisamos mostrar a notificação push para evitar duplicação
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(async (clientList) => {
      // Verificar se há algum cliente visível
      let hasVisibleClient = false
      
      for (const client of clientList) {
        try {
          // Verificar visibilityState (pode não estar disponível em todos os navegadores)
          const visibilityState = client.visibilityState
          const isFocused = client.focused
          
          // Cliente está visível se visibilityState é 'visible' OU se está focado
          if (visibilityState === 'visible' || isFocused === true) {
            hasVisibleClient = true
            
            // Enviar mensagem para o cliente sobre o push recebido (para atualizar badge)
            // Mesmo que não mostremos a notificação push, queremos que o cliente saiba
            try {
              client.postMessage({
                type: 'push_received',
                data: notificationData.data,
                title: notificationData.title,
                body: notificationData.body
              })
            } catch (msgError) {
              console.log('[SW] Não foi possível enviar mensagem para cliente:', msgError)
            }
            break
          }
        } catch (err) {
          // Se houver erro ao verificar um cliente, continuar verificando os outros
          console.log('[SW] Erro ao verificar cliente:', err)
        }
      }

      if (hasVisibleClient) {
        console.log('[SW] ⏭️ App está aberto e visível - pulando notificação push (notificação interna será exibida)')
        return Promise.resolve()
      }

      // Se não há clientes visíveis, mostrar a notificação push normalmente
      console.log('[SW] 📋 App não está visível - mostrando notificação push')
      console.log('[SW] 📋 Processing notification for:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other')
      console.log('[SW] 📋 Title:', notificationData.title)
      console.log('[SW] 📋 Body:', notificationData.body)

      // Tentar enviar mensagem para qualquer cliente (mesmo que não visível) para atualizar badge
      // Isso garante que quando o usuário abrir o app, o badge esteja atualizado
      for (const client of clientList) {
        try {
          client.postMessage({
            type: 'push_received',
            data: notificationData.data,
            title: notificationData.title,
            body: notificationData.body
          })
          break // Enviar apenas para um cliente
        } catch (msgError) {
          // Ignorar erro
        }
      }

      try {
        console.log('[SW] 🔄 Calling showNotification...')
        return self.registration.showNotification(notificationData.title, notificationData)
          .then(() => {
            console.log('[SW] ✅ showNotification called successfully')
            
            // Atualizar badge quando mostrar notificação push
            // O badge será atualizado quando o usuário abrir o app e processar a mensagem
          })
          .catch((error) => {
            console.error('[SW] ❌ FAILED TO SHOW NOTIFICATION:', error.message)
            console.error('[SW] ❌ For browser:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other')
            console.error('[SW] ❌ Notification data:', notificationData.title, '-', notificationData.body)

            // Tentar mostrar uma notificação básica se a personalizada falhar
            return self.registration.showNotification('⚽ Gol!', {
              body: 'Um gol foi marcado!',
              icon: '/icon-192x192.jpg'
            }).catch((fallbackError) => {
              console.error('[SW] ❌ Even basic notification failed:', fallbackError.message)
            })
          })
      } catch (error) {
        console.error('[SW] ❌ Error in showNotification:', error)
        return Promise.resolve()
      }
    }).catch((error) => {
      // Em caso de erro ao verificar clientes, mostrar a notificação por segurança
      // (melhor mostrar do que não mostrar se o app estiver fechado)
      console.error('[SW] ⚠️ Erro ao verificar clientes, mostrando notificação por segurança:', error)
      try {
        return self.registration.showNotification(notificationData.title, notificationData)
      } catch (showError) {
        console.error('[SW] ❌ Erro ao mostrar notificação:', showError)
        return Promise.resolve()
      }
    })
  )
})

// Escutar cliques em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 👆 Clicked:', event.notification.title)
  event.notification.close()
  
  // Fechar a notificação imediatamente
  event.notification.close()

  // Obter URL de destino dos dados da notificação ou usar padrão
  const urlToOpen = event.notification.data?.url || '/'
  const baseUrl = self.location.origin
  const fullUrl = `${baseUrl}${urlToOpen}`

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Tentar encontrar uma janela que já está aberta na mesma origem
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.startsWith(baseUrl)) {
          // Se encontrou uma janela da mesma origem, focar nela
          if ('focus' in client) {
            client.focus()
            // Enviar mensagem para o cliente navegar se necessário
            if (client.url !== fullUrl) {
              client.postMessage({
                type: 'navigate',
                url: urlToOpen
              })
            }
            return Promise.resolve()
          }
        }
      }
      
      // Se não encontrou janela aberta, abrir nova
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
      
      return Promise.resolve()
    }).catch((error) => {
      console.error('[SW] Erro ao processar clique na notificação:', error)
      // Tentar abrir janela mesmo com erro
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
      return Promise.resolve()
    })
  )
})

