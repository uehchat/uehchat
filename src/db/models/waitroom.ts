import { Schema, Document, model } from 'mongoose';

const WaitRoomSchema: Schema = new Schema({
  id: {
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

export interface WaitRoomProps extends Document {
  id: string;
  time: Date;
}

export default model<WaitRoomProps>('waitroom', WaitRoomSchema);
