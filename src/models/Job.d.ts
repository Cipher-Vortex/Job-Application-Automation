import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IJob, {}, {}, {}, Document<unknown, {}, IJob, {}, mongoose.DefaultSchemaOptions> & IJob & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IJob>;
export default _default;
//# sourceMappingURL=Job.d.ts.map