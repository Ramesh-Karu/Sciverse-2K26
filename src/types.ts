export interface School {
  id: string;
  name: string;
  principalName: string;
  teacherInCharge: string;
  teacherInChargeEmail?: string;
  teacherInChargePhone?: string;
  contact: string;
  whatsapp?: string;
  email: string;
  address: string;
  logoUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  registrationId?: string;
  qrCodeUrl?: string;
  expectedStudents: number;
  expectedTeachers: number;
  preferredDay: string;
  arrivalTime: string;
  specialRequirements: string;
  quota?: number;
  checkedIn?: boolean;
  checkInTime?: string;
  actualStudents?: number;
  actualTeachers?: number;
  createdAt: string;
}

export interface Participant {
  id: string;
  schoolId: string;
  name: string;
  type: 'student' | 'teacher';
  role: string; // e.g. Grade 11, Grade 12 or Physics Teacher
  contact: string;
  competitions: string[];
  checkedIn: boolean;
  checkInTime?: string;
}

export interface EventDay {
  id: string;
  date: string;
  name: string;
  capacity: number;
  reservedSeats: number;
  usedCapacity?: number;
  description?: string;
  isOpenForRegistration?: boolean;
  reservedDetails?: {
    vips: number;
    judges: number;
    organizers: number;
    teachers: number;
    media: number;
    guests: number;
  };
}

export interface ArrivalSlot {
  id: string;
  time: string;
  capacity: number;
  currentCount: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'alert' | 'info' | 'schedule';
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  schoolId?: string;
  schoolName: string;
  email: string;
  subject: string;
  message: string;
  type: 'approved' | 'rejected' | 'reminder' | 'announcement';
  sentAt: string;
}
