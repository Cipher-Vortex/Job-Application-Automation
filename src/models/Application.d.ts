import mongoose, { Document } from 'mongoose';
export interface IApplication extends Document {
    jobId: mongoose.Types.ObjectId;
    resumeVersion: string;
    coverLetter: string;
    screeningAnswers: Record<string, string>;
    applicationId: string;
    appliedDate: Date;
    followUpDate: Date;
}
declare const _default: mongoose.Model<IApplication, {}, {}, {}, Document<unknown, {}, IApplication, {}, mongoose.DefaultSchemaOptions> & IApplication & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IApplication>;
export default _default;
//# sourceMappingURL=Application.d.ts.map