import { serve } from '@hono/node-server'
import { Hono } from 'hono'

type Env = {
  Bindings: {
    PRIVATE_KEY: string
  }
}

const app = new Hono<Env>()

app.get('/', (c) => {
  console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY)
  return c.text('Hello Hono! テスト実行中')
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
})