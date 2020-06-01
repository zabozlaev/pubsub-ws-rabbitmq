import { v4 } from 'uuid';
import { createServer, IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';

import { createQueue, Queue } from './queue';
import { logger } from './logger';

type WsConn = WebSocket & { id?: string };

type ReplyFn = <T = object | string>(
  event: string,
  data: T,
) => Promise<void> | void;

type Handler = <T = object>(
  wss: WebSocket.Server,
  ws: WsConn,
  req: IncomingMessage,
  data: T,
  reply: ReplyFn,
) => Promise<void> | void;

class WsRouter {
  private _unknownEventHandler: Handler;
  private _events: string[];
  private _subscribers: { [key: string]: WsConn[] };
  private _emitter: EventEmitter;

  constructor(public queue: Queue, unknownEventHander) {
    this._unknownEventHandler = unknownEventHander;
    this._events = [];
    this._subscribers = {};
    this._emitter = new EventEmitter();
  }

  on(name, handler) {
    if (this._events.indexOf(name) === -1) {
      this._events.push(name);
    }

    this._emitter.on(name, handler);
  }

  subscribe(name, client: WsConn) {
    let subs = this._subscribers[name];
    if (!subs) {
      this._subscribers[name] = [];
      this.queue.consume(name, (msg) => {
        this.resolveSubscription(name, msg);
        this.queue.ack(msg);
      });
    }

    logger.info(`conn ${client.id} subscribed ${name}`);
    this._subscribers[name].push(client);
  }

  resolveSubscription(name, data) {
    const clients = this._subscribers[name];
    clients.forEach((client) =>
      client.send(
        JSON.stringify({
          event: `subscription:${name}`,
          data: JSON.parse(data.content),
        }),
      ),
    );
  }

  emit(name: string, wss, ws, req, data, reply: ReplyFn) {
    return !this.isCorrectEvent(name)
      ? this._unknownEventHandler(wss, ws, req, data, reply)
      : this._emitter.emit(name, wss, ws, req, data, reply);
  }

  isCorrectEvent(name) {
    return !!this._events.find((e) => e === name);
  }
}

const server = createServer((req, res) => res.end('404'));

const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws, req) => {
  (ws as WsConn).id = v4();

  const queue = await createQueue();
  const router = new WsRouter(queue, (...data) => {});

  ws.on('message', (body) => {
    try {
      const { event, data } = JSON.parse(body as string);
      router.emit(event, wss, ws, req, data, (event, data) =>
        ws.send(JSON.stringify({ event, data })),
      );
    } catch (error) {
      logger.error(error);
      ws.close();
    }

    const handler = (wss, ws, req, data, reply) => {
      ws('bye', { bye: 'mate' });
    };

    const subscribeHandler = (wss, ws, req, data, reply) => {
      reply('success', { message: `successful subscription for: news` });
      router.subscribe('news', ws);
    };

    const newsHandler = (wss, ws, req, data, reply) => {
      queue.publishToQueue('news', data);
    };

    router.on('hello', handler);
    router.on('subscribe:news', subscribeHandler);
    router.on('news', newsHandler);
  });

  ws.on('close', () =>
    router.emit('close', wss, ws, null, null, (_, __) => {}),
  );
});

server.listen(3023, () => {
  logger.info(`Pubsub ready on ${process.env.PORT}`);
});
