/**
 * CHATIBLE implementation (aka the most important part of this project).
 * @packageDocumentation
 */

import db from '../db';
import lang from '../lang';
import config from '../config';

import fb from '../utils/facebook';
import logger from '../utils/logger';
import gifts from '../utils/gifts';

import { WebhookMessagingEvent, WebhookMessageObject } from '../interfaces/FacebookAPI';

/**
 * Connect two users and add them to chat room
 * @param id1 - ID of first user
 * @param id2 - ID of second user
 */
const pairPeople = async (id1: string, id2: string): Promise<void> => {
  await db.removeFromWaitRoom(id1);
  await db.removeFromWaitRoom(id2);
  await db.writeToChatRoom(id1, id2);
  await db.updateLastPerson(id1, id2);
  await db.updateLastPerson(id2, id1);
  await fb.sendTextMessage('', id1, lang.CONNECTED, false);
  await fb.sendTextMessage('', id2, lang.CONNECTED, false);
  await logger.logPair(id1, id2);
};

/**
 * Find a user in wait room to match with new user.
 * If found, pair them. Otherwise, add new user to wait room.
 * @param id - ID of new user
 */
const findPair = async (id: string): Promise<void> => {
  const waitRoomList = await db.getListWaitRoom();

  for (const entry of waitRoomList) {
    const target = entry.id;

    // check if they have just been paired
    if ((await db.checkLastPerson(id, target)) || (await db.checkLastPerson(target, id))) {
      continue;
    }

    await pairPeople(id, target);
    return;
  }

  // found no match, put in wait room
  await db.writeToWaitRoom(id);

  await fb.sendTextMessage('', id, lang.START_OKAY, false);
};

/**
 * Disconnect paired users
 * @param id1 - ID of first user
 * @param id2 - ID of second user
 */
const processEndChat = async (id1: string, id2: string): Promise<void> => {
  await db.removeFromChatRoom(id1); // or await db.removeFromChatRoom(id2);
  await fb.sendTextButtons(id1, lang.END_CHAT, true, true, true, false);
  await fb.sendTextButtons(id2, lang.END_CHAT_PARTNER, true, true, true, false);
};

/**
 * Forward message from sender to receiver
 * @param sender - ID of sender
 * @param receiver - ID of receiver
 * @param data - Message data to forward
 */
const forwardMessage = async (sender: string, receiver: string, data: WebhookMessageObject): Promise<void> => {
  if (data.attachments) {
    if (data.attachments[0]) {
      const type = data.attachments[0].type;
      if (type === 'fallback') {
        let text: string;
        if (data.text) {
          text = data.text;
        } else {
          text = lang.ATTACHMENT_LINK + data.attachments[0].payload.url;
        }
        await fb.sendTextMessage(sender, receiver, text, true);
      } else if (type === 'image' || type === 'video' || type === 'audio' || type === 'file') {
        await fb.sendAttachment(sender, receiver, type, data.attachments[0].payload.url, false, true);
      } else {
        await fb.sendTextMessage('', sender, lang.ERR_ATTACHMENT, false);
        return;
      }
    }

    for (let i = 1; i < data.attachments.length; i++) {
      const type = data.attachments[i].type;
      if (type === 'image' || type === 'video' || type === 'audio' || type === 'file') {
        await fb.sendAttachment(sender, receiver, type, data.attachments[i].payload.url, false, true);
      }
    }
  } else {
    await fb.sendTextMessage(sender, receiver, data.text, true);
  }
};

/**
 * Process messaging event sent by Facebook
 * @param event - Messaging event
 */
const processEvent = async (event: WebhookMessagingEvent): Promise<void> => {
  if (event.read) {
    event.message = { text: '' };
  }

  if (event.postback && event.postback.payload) {
    event.message = { text: event.postback.payload };
  }

  if (!event.hasOwnProperty('message') || event.delivery) {
    return;
  }

  if (event.message.is_echo === true) {
    return;
  }

  const sender: string = event.sender.id;

  if (config.MAINTENANCE) {
    await fb.sendTextMessage('', sender, lang.MAINTENANCE, false);
    return;
  }

  let text = '';
  if (event.message.quick_reply && event.message.quick_reply.payload) {
    text = event.message.quick_reply.payload;
  } else if (event.message.text) {
    text = event.message.text;
  }

  let command = '';
  if (text.length < 20) {
    command = text.toLowerCase().replace(/ /g, '');
  }

  if (command === 'ʬ') {
    await fb.sendTextButtons(sender, lang.FIRST_COME, true, false, true, false);
    return;
  }

  // fetch person state
  const waitState: boolean = await db.isInWaitRoom(sender);
  const sender2: string | null = await db.findPartnerChatRoom(sender);

  if (!waitState && sender2 === null) {
    // neither in chat room nor wait room
    if (command === lang.KEYWORD_START) {
      await findPair(sender);
    } else if (command === lang.KEYWORD_HELP) {
      await fb.sendTextButtons(sender, lang.HELP_TXT, true, false, true, false);
    } else if (command === lang.KEYWORD_CAT) {
      await gifts.sendCatPic(sender, null);
    } else if (command === lang.KEYWORD_DOG) {
      await gifts.sendDogPic(sender, null);
    } else if (!event.read) {
      await fb.sendTextButtons(sender, lang.INSTRUCTION, true, false, true, false);
    }
  } else if (waitState && sender2 === null) {
    // in wait room and waiting
    if (command === lang.KEYWORD_END) {
      await db.removeFromWaitRoom(sender);
      await fb.sendTextButtons(sender, lang.END_CHAT, true, false, true, false);
    } else if (command === lang.KEYWORD_HELP) {
      await fb.sendTextButtons(sender, lang.HELP_TXT, false, false, true, false);
    } else if (command === lang.KEYWORD_CAT) {
      await gifts.sendCatPic(sender, null);
    } else if (command === lang.KEYWORD_DOG) {
      await gifts.sendDogPic(sender, null);
    } else if (!event.read) {
      await fb.sendTextButtons(sender, lang.WAITING, false, false, true, false);
    }
  } else if (!waitState && sender2 !== null) {
    // in chat room
    if (command === lang.KEYWORD_END) {
      await processEndChat(sender, sender2);
    } else if (command === lang.KEYWORD_START) {
      await fb.sendTextMessage('', sender, lang.START_ERR_ALREADY, false);
    } else if (command === lang.KEYWORD_HELP) {
      await fb.sendTextButtons(sender, lang.HELP_TXT, false, true, true, false);
    } else if (command === lang.KEYWORD_CAT) {
      await forwardMessage(sender, sender2, event.message);
      await gifts.sendCatPic(sender, sender2);
    } else if (command === lang.KEYWORD_DOG) {
      await forwardMessage(sender, sender2, event.message);
      await gifts.sendDogPic(sender, sender2);
    } else {
      // FIX-ME: Only send seen indicator for messages before watermark
      if (event.read) {
        await fb.sendSeenIndicator(sender2);
      } else if (text.trim().toLowerCase().startsWith('[bot]')) {
        await fb.sendTextMessage('', sender, lang.ERR_FAKE_MSG, false);
      } else {
        await forwardMessage(sender, sender2, event.message);
      }
    }
  } else {
    await db.removeFromWaitRoom(sender);
    await db.removeFromChatRoom(sender);
    await fb.sendTextMessage('', sender, lang.ERR_UNKNOWN, false);
  }
};

/**
 * Remove timeout users in wait room every minute.
 * Timeout is specified in config.
 */
const removeTimeoutUser = async (): Promise<void> => {
  const waitRoomList = await db.getListWaitRoom();

  const now = new Date();
  waitRoomList.forEach(async (entry) => {
    if (now.getTime() - entry.time.getTime() > config.MAX_WAIT_TIME_MINUTES * 60000) {
      await db.removeFromWaitRoom(entry.id);
      await fb.sendTextButtons(entry.id, lang.END_CHAT_FORCE, true, false, true, false);
    }
  });
};

export default {
  processEvent,
  removeTimeoutUser,
};
