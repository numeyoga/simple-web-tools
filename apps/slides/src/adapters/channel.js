// The BroadcastChannel between the main window and the presenter window, named with the app
// prefix (decision 0005). Messages go out as they are and come in through `parseMessage`: a
// malformed one, from any page of the origin, never reaches a handler.
import { parseMessage } from '../core/messages.js';
import { channelName } from './names.js';

/**
 * @typedef {import('../core/messages.js').Message} Message
 * @returns {{ post: (message: Message) => void, onMessage: (handler: (message: Message) => void) => () => void, close: () => void }}
 */
export function createChannel() {
  const channel = new BroadcastChannel(channelName());
  return {
    post: (message) => channel.postMessage(message),
    onMessage(handler) {
      /** @param {MessageEvent} event */
      const listener = (event) => {
        const message = parseMessage(event.data);
        if (message) handler(message);
      };
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}
