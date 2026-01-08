import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url, method = 'GET', headers = {}, body, stream = false } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)
    
    // Handle streaming response
    if (stream && response.body) {
      // Стримим всегда когда запрошен стрим (даже при ошибках)
      // Клиент сам разберётся с форматом ответа
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      
      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true })
          controller.enqueue(encoder.encode(text))
        }
      })
      
      response.body.pipeThrough(transformStream)
      
      return new Response(transformStream.readable, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Original-Status': String(response.status),
        }
      })
    }
    
    const contentType = response.headers.get('content-type')
    let data
    
    if (contentType?.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      ok: false, 
      error: message 
    }, { status: 500 })
  }
}
