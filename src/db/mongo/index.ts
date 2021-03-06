/**
 * Methods for writing to MongoDB
 * @packageDocumentation
 */

import { Mutex } from 'async-mutex';

import ChatRoom from '../models/chatroom';
import WaitRoom from '../models/waitroom';
import LastPerson from '../models/lastperson';
import logger from '../../utils/logger';

/**
 * `findOneAndUpdate` with `upsert` is not atomic.
 * We lock Mongo so that only one operation is allowed at a time.
 */
const mongoMutex = new Mutex();

/**
 * Add user to wait room
 * @param id - ID of user
 */
const waitRoomWrite = async (id: string, time: Date): Promise<void> => {
  const release = await mongoMutex.acquire();
  try {
    await WaitRoom.findOneAndUpdate({ id }, { $set: { time } }, { upsert: true });
  } catch (err) {
    logger.logError('mongo::waitRoomWrite', 'Failed to save data to MongoDB', err, true);
  } finally {
    release();
  }
};

/**
 * Remove user from wait room
 * @param id - ID of user
 */
const waitRoomRemove = async (id: string): Promise<void> => {
  const release = await mongoMutex.acquire();
  try {
    await WaitRoom.deleteOne({ id });
  } catch (err) {
    logger.logError('mongo::waitRoomRemove', 'Failed to save data to MongoDB', err, true);
  } finally {
    release();
  }
};

/**
 * Add paired users to chat room
 * @param id1 - ID of first user
 * @param id2 - ID of second user
 * @param time - Time when paired
 */
const chatRoomWrite = async (id1: string, id2: string, time: Date): Promise<void> => {
  const release = await mongoMutex.acquire();
  try {
    await ChatRoom.findOneAndUpdate({ id1 }, { $set: { id2, time } }, { upsert: true });
  } catch (err) {
    logger.logError('mongo::chatRoomWrite', 'Failed to save data to MongoDB', err, true);
  } finally {
    release();
  }
};

/**
 * Remove paired users from chat room
 * @param id - ID of one of two user
 */
const chatRoomRemove = async (id: string): Promise<void> => {
  const release = await mongoMutex.acquire();
  try {
    await ChatRoom.deleteOne({ $or: [{ id1: id }, { id2: id }] });
  } catch (err) {
    logger.logError('mongo::chatRoomRemove', 'Failed to save data to MongoDB', err, true);
  } finally {
    release();
  }
};

/**
 * Set `user2` as the last person paired with `user1`
 * @param id1 - ID of `user1`
 * @param id2 - ID of `user2`
 */
const lastPersonWrite = async (id1: string, id2: string): Promise<void> => {
  const release = await mongoMutex.acquire();
  try {
    await LastPerson.findOneAndUpdate({ id1 }, { $set: { id2 } }, { upsert: true });
  } catch (err) {
    logger.logError('db::updateLastPerson', 'Failed to save data to MongoDB', err, true);
  } finally {
    release();
  }
};

/**
 * Delete everything in database
 */
const resetDatabase = async (): Promise<void> => {
  const release = await mongoMutex.acquire();

  try {
    await ChatRoom.deleteMany({});
  } catch (err) {
    logger.logError('mongo::resetDatabase::chatRoom', 'Failed to save data to MongoDB', err, true);
  }

  try {
    await WaitRoom.deleteMany({});
  } catch (err) {
    logger.logError('mongo::resetDatabase::waitRoom', 'Failed to save data to MongoDB', err, true);
  }

  try {
    await LastPerson.deleteMany({});
  } catch (err) {
    logger.logError('mongo::resetDatabase::lastPerson', 'Failed to save data to MongoDB', err, true);
  }

  release();
};

export default {
  waitRoomWrite,
  waitRoomRemove,
  chatRoomWrite,
  chatRoomRemove,
  lastPersonWrite,
  resetDatabase,
};
