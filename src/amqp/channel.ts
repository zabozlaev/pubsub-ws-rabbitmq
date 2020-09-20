import * as amqp from 'amqplib/callback_api';

export class Channel {
  constructor(private chan: amqp.Channel, private queue: string) {}

  private get channel(): amqp.Channel {
    if (!this.chan) {
      throw new Error('Channel is closed');
    }
    return this.chan;
  }

  async consume(
    fn: (msg: amqp.Message | null) => any,
    options: amqp.Options.Consume = {},
  ): Promise<amqp.Replies.Consume> {
    return new Promise<amqp.Replies.Consume>((resolve, reject) =>
      this.channel.consume(this.queue, fn, options, (err, ok) =>
        err ? reject(err) : resolve(ok),
      ),
    );
  }

  async publishToQueue(data) {
    this.channel.sendToQueue(this.queue, new Buffer(JSON.stringify(data)));
  }

  ack(msg: amqp.Message) {
    this.channel.ack(msg);
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) =>
      this.channel.close((err) => (err ? reject(err) : resolve)),
    );
  }
}
