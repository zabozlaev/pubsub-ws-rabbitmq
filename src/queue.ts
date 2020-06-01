import * as amqp from 'amqplib/callback_api';
import { logger } from './logger';

export class Queue {
  constructor(private _channel: amqp.Channel) {}

  close() {
    return this._channel.close(() => {});
  }

  async consume(queueName, fn) {
    this._channel.consume(queueName, fn);
  }

  async publishToQueue(queueName, data) {
    this._channel.sendToQueue(queueName, new Buffer(JSON.stringify(data)));
  }

  ack(msg: amqp.Message) {
    this._channel.ack(msg);
  }
}

export const createQueue = async () => {
  const channel = await new Promise<amqp.Channel>((resolve, reject) =>
    amqp.connect(
      {
        hostname: 'rabbit',
        port: 5672,
        username: 'zabozlaev',
        password: '123',
        protocol: 'amqp',
      },
      (err, conn) => {
        if (err) {
          logger.error(err);
          reject(err);
        }

        logger.info(`Connected to RabbitMQ`);
        conn.createChannel(function (err, channel) {
          if (err) {
            logger.error(err);
            reject(err);
          }
          resolve(channel);
        });
      },
    ),
  );

  return new Queue(channel);
};
