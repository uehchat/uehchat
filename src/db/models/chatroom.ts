import { Schema, Document, model } from 'mongoose';

const ChatRoomSchema: Schema = new Schema({
  id1: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  id2: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  time: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

export interface ChatRoomProps extends Document {
  id1: string;
  id2: string;
  time: Date;
}

export default model<ChatRoomProps>('chatroom', ChatRoomSchema);
