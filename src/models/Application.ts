import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  resumeVersion: string;
  coverLetter: string;
  screeningAnswers: Record<string, string>;
  applicationId: string;
  appliedDate: Date;
  followUpDate: Date;
}

const ApplicationSchema: Schema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  resumeVersion: { type: String },
  coverLetter: { type: String },
  screeningAnswers: { type: Map, of: String },
  applicationId: { type: String },
  appliedDate: { type: Date },
  followUpDate: { type: Date }
}, { timestamps: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
