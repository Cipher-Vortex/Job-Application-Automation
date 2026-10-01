import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
  company: string;
  jobTitle: string;
  jobUrl: string;
  source: string;
  location: string;
  remoteStatus: 'Remote' | 'Hybrid' | 'On-site';
  experienceRequired: string;
  salary: string;
  jobDescription: string;
  postedDate: Date;
  matchScore: number;
  skillsMatched: string[];
  missingSkills: string[];
  status: 'Discovered' | 'Analyzed' | 'Prepared' | 'Pending Approval' | 'Approved' | 'Applied' | 'Rejected' | 'Skipped';
}

const JobSchema: Schema = new Schema({
  company: { type: String, required: true },
  jobTitle: { type: String, required: true },
  jobUrl: { type: String, required: true, unique: true },
  source: { type: String },
  location: { type: String },
  remoteStatus: { type: String },
  experienceRequired: { type: String },
  salary: { type: String },
  jobDescription: { type: String, required: true },
  postedDate: { type: Date, default: Date.now },
  matchScore: { type: Number, default: 0 },
  skillsMatched: [{ type: String }],
  missingSkills: [{ type: String }],
  status: { type: String, default: 'Discovered' }
}, { timestamps: true });

export default mongoose.model<IJob>('Job', JobSchema);
