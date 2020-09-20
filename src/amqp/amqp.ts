import * as amqp from 'amqplib/callback_api';
import { Channel } from './channel';

export class Amqp {
  private conn: amqp.Connection;

  private get connection(): amqp.Connection {
    if (!this.conn) {
      throw new Error('Connection is not initialized');
    }

    return this.conn;
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) =>
      amqp.connect(
        {
          hostname: 'rabbit',
          port: 5672,
          username: 'zabozlaev',
          password: '123',
          protocol: 'amqp',
        },
        (err, conn) => {
          if (err) reject(err);

          this.conn = conn;
          resolve();
        },
      ),
    );
  }

  createChannel(queue: string): Promise<Channel> {
    return new Promise<Channel>((resolve, reject) =>
      this.connection.createChannel((err, chan) => {
        if (err) reject(err);
        resolve(new Channel(chan, queue));
      }),
    );
  }
}
