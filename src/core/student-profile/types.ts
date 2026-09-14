/** 可编辑资料。note 是内部备注，独立于可对外分享的学习记录。 */
export interface StudentDetails {
  grade?: string;
  school?: string;
  goal?: string;
  guardian?: string;
  contact?: string;
  communication?: string;
  tags?: string[];
}
export interface StudentProfileInput extends StudentDetails {
  name: string;
  courseIds: string[];
  note: string;
  referrerId?: string;
}
