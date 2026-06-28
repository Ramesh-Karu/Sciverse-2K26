import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, getDocs, deleteDoc, addDoc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { School, Participant, EventDay, ArrivalSlot, NotificationLog, SoloStudent } from '../types';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { SchoolPassCard, CardSchoolData } from '../components/StylishCardGenerator';
import QRScanner from '../components/QRScanner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Check, X, Shield, Calendar, Users, Cpu, FileText, 
  Settings, UserCheck, Search, Sliders, Play, TrendingUp, Sparkles, AlertTriangle, RefreshCcw, Download, Trash2, ShieldCheck, QrCode,
  Mail, MessageSquare, ChevronDown, User, Phone
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { success, error: toastError, info, warning: toastWarning } = useToast();
  
  // Data State
  const [schools, setSchools] = useState<School[]>([]);
  const [eventDays, setEventDays] = useState<EventDay[]>([]);
  const [arrivalSlots, setArrivalSlots] = useState<ArrivalSlot[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [soloStudents, setSoloStudents] = useState<SoloStudent[]>([]);
  const [admins, setAdmins] = useState<{ id: string; email: string; addedBy?: string; addedAt?: string }[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'approvals' | 'passes' | 'capacities' | 'checkin' | 'predictions' | 'logs' | 'admins' | 'soloStudents'>('approvals');
  const [soloTab, setSoloTab] = useState<'pending' | 'approved' | 'rejected' | 'checkin'>('pending');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxSchoolsLimit, setMaxSchoolsLimit] = useState(15);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // WhatsApp manual push notification state
  const [waModalData, setWaModalData] = useState<{
    phone: string;
    message: string;
    schoolName: string;
    registrationId: string;
  } | null>(null);

  const getWhatsAppMessage = (school: School, regId: string) => {
    const preferredDay = school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)';
    const arrivalTime = school.arrivalTime || '08:30 AM - 09:00 AM';
    const portalDirectLink = `https://sujhc.site/?login=${school.id}`;
    
    return `*SciVerse 2K26 Registration Confirmed!* 🚀\nOrganized by: *Science Union, Jaffna Hindu College*\n\nDear *${school.teacherInCharge}*,\n\nWe are thrilled to inform you that the registration for *${school.name}* is officially confirmed! \n\n*Admission & Portal Access:*\n============================\n🎫 *Registration ID:* ${regId}\n📅 *Event Day:* ${preferredDay}\n⏰ *Arrival Time Slot:* ${arrivalTime}\n\n*Download your QR Pass here:*\n============================\n${portalDirectLink}\n\n*Instructions:*\n1. Click the link above to access your school portal.\n2. From the portal, you can download your QR Entry Pass, manage student rosters, and print ID cards.\n3. Present your Registration ID or QR Pass at the gate for verification.\n\nSee you at the Science Union Exhibition!`;
  };

  const getWhatsAppMessageSolo = (student: SoloStudent, regId: string) => {
    const preferredDay = student.preferredDay || 'SciVerse Event Track';
    const arrivalTime = student.arrivalTime || 'To Be Scheduled';
    const portalDirectLink = `https://sujhc.site/?login=${student.id}&solo=true`;
    
    return `*SciVerse 2K26 Solo Registration Confirmed!* 🚀\nOrganized by: *Science Union, Jaffna Hindu College*\n\nDear *${student.name}*,\n\nWe are thrilled to inform you that your solo registration is officially confirmed! \n\n*Admission & Portal Access:*\n============================\n🎫 *Registration ID:* ${regId}\n📅 *Event Day:* ${preferredDay}\n⏰ *Arrival Time Slot:* ${arrivalTime}\n\n*Download your QR Pass here:*\n============================\n${portalDirectLink}\n\n*Instructions:*\n1. Click the link above to access your personal dashboard.\n2. Download your QR Entry Pass from the dashboard.\n3. Present your Registration ID or QR Pass at the gate for verification.\n\nSee you at the Science Union Exhibition!`;
  };

  // AI Predictor State
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Gate check-in verification modal state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [schoolToCheckIn, setSchoolToCheckIn] = useState<School | null>(null);
  const [actualStudents, setActualStudents] = useState<number>(0);
  const [actualTeachers, setActualTeachers] = useState<number>(0);
  const [isFinalizingCheckIn, setIsFinalizingCheckIn] = useState(false);

  // Gate check-in scanner search
  const [scannerInput, setScannerInput] = useState('');
  const [scannerResult, setScannerResult] = useState<string | null>(null);

  const { user, loading: authLoading, isAdmin } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      navigate('/');
      return;
    }
    
    // Subscribe to schools
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      // Sort by newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSchools(list);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });

    // Subscribe to Event Days
    const unsubDays = onSnapshot(collection(db, 'eventDays'), (snapshot) => {
      setEventDays(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventDay)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'eventDays');
    });

    // Subscribe to Arrival Slots
    const unsubSlots = onSnapshot(collection(db, 'arrivalSlots'), (snapshot) => {
      setArrivalSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArrivalSlot)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'arrivalSlots');
    });

    // Subscribe to Notification logs
    const unsubLogs = onSnapshot(collection(db, 'notificationLogs'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationLog));
      list.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setLogs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notificationLogs');
    });

    // Subscribe to Admins
    const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, email: doc.id, ...doc.data() } as any));
      setAdmins(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'admins');
    });

    // Subscribe to solo students
    const unsubSolo = onSnapshot(collection(db, 'soloStudents'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSoloStudents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'soloStudents');
    });

    return () => {
      unsubSchools();
      unsubDays();
      unsubSlots();
      unsubLogs();
      unsubAdmins();
      unsubSolo();
    };
  }, [user, authLoading, navigate]);

  // Handle Approving a School
  const handleApprove = async (school: School) => {
    const approvedCount = schools.filter(s => s.status === 'approved').length;
    
    if (approvedCount >= maxSchoolsLimit) {
      if (!window.confirm(`WARNING: Approved school limit of ${maxSchoolsLimit} has been reached. Placing this school in the Waitlist priority. Do you wish to override and approve anyway?`)) {
        return;
      }
    }

    try {
      const regId = school.registrationId;

      // Update school details
      try {
        await updateDoc(doc(db, 'schools', school.id), {
          status: 'approved',
          quota: 999999 // Unlimited allotment
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `schools/${school.id}`);
      }

      // Submit an official notification audit
      try {
        await addDoc(collection(db, 'notificationLogs'), {
          schoolId: school.id,
          schoolName: school.name,
          email: school.email,
          subject: `SciVerse 2K26 Registration APPROVED!`,
          message: `Dear ${school.teacherInCharge}, your delegation registration is approved. Your School Registration ID is ${regId}. Access the school portal using this ID to view your official master admission pass, set arrival schedules, or verify quota allocations.`,
          type: 'approved',
          sentAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'notificationLogs');
      }

      // Automatically dispatch the gorgeous confirmation email on the server
      const qrPassUrl = `https://quickchart.io/chart?cht=qr&chl=${regId}&chs=150x150`;
      try {
        await fetch('/api/email/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: school.name,
            email: school.email,
            teacherInCharge: school.teacherInCharge,
            registrationId: regId,
            qrCodeUrl: qrPassUrl,
            quota: 999999, // Unlimited allotment
            preferredDay: school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)',
            arrivalTime: school.arrivalTime || '08:30 AM - 09:00 AM',
          }),
        });
      } catch (emailErr) {
        console.error("Failed to automatically dispatch confirmation email:", emailErr);
      }

      // Open the elegant WhatsApp trigger modal
      setWaModalData({
        phone: school.whatsapp || school.contact || '',
        message: getWhatsAppMessage(school, regId),
        schoolName: school.name,
        registrationId: regId
      });

      success(`Approved: ${school.name}. Assigned Reg ID: ${regId}`);
    } catch (err) {
      console.error(err);
      toastError(`Failed to approve registration: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle Rejecting a School
  const handleReject = async (school: School) => {
    if (window.confirm(`Decline registration request for ${school.name}?`)) {
      try {
        await updateDoc(doc(db, 'schools', school.id), {
          status: 'rejected'
        });

        await addDoc(collection(db, 'notificationLogs'), {
          schoolId: school.id,
          schoolName: school.name,
          email: school.email,
          subject: 'SciVerse 2K26 Registration Declined',
          message: `Dear ${school.teacherInCharge}, your registration request has been declined because seating capacity bounds have been reached. Reach out to appeal.`,
          type: 'rejected',
          sentAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `schools/${school.id}`);
      }
    }
  };

  // Handle Deleting a School Entry
  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the school delegation "${schoolName}"? This will permanently delete the school registration record.`)) {
      return;
    }
    try {
      // 1. Delete all participants in the subcollection first (if any exist)
      const partsSnap = await getDocs(collection(db, `schools/${schoolId}/participants`));
      if (!partsSnap.empty) {
        const batch = writeBatch(db);
        partsSnap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // 2. Delete the school document itself
      await deleteDoc(doc(db, 'schools', schoolId));

      // 3. Log notification/audit
      await addDoc(collection(db, 'notificationLogs'), {
        schoolId: schoolId,
        schoolName: schoolName,
        email: 'system',
        subject: `Delegation DELETED: ${schoolName}`,
        message: `School delegation "${schoolName}" has been removed from the database by an administrator.`,
        type: 'reminder',
        sentAt: new Date().toISOString()
      });

      success(`Successfully deleted the "${schoolName}" delegation record.`);
    } catch (err) {
      console.error("Error deleting school: ", err);
      toastError("Error deleting school. See console for details.");
    }
  };

  // Resend official HTML confirmation email
  const handleResendEmail = async (school: School) => {
    const regId = school.registrationId;
    if (!regId) {
      toastError("This school does not have a registration ID assigned.");
      return;
    }
    
    const qrPassUrl = `https://quickchart.io/chart?cht=qr&chl=${regId}&chs=150x150`;
    info(`Sending confirmation email to ${school.email}...`);
    try {
      const res = await fetch('/api/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: school.id,
          name: school.name,
          email: school.email,
          teacherInCharge: school.teacherInCharge,
          registrationId: regId,
          qrCodeUrl: qrPassUrl,
          quota: 999999, // Unlimited allotment
          preferredDay: school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)',
          arrivalTime: school.arrivalTime || '08:30 AM - 09:00 AM',
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.method === 'simulation') {
          success(`[Simulation Mode] Confirmation email logged successfully in Server Console! (No RESEND_API_KEY configured in Secrets panel)`);
        } else {
          success(`Confirmation email sent successfully to ${school.email}!`);
        }
      } else {
        toastError(`Failed to send email: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Resend email error:", err);
      toastError("Failed to dispatch confirmation email.");
    }
  };

  // Open manual WhatsApp trigger modal for confirmed school
  const handleTriggerWhatsApp = (school: School) => {
    const regId = school.registrationId;
    if (!regId) {
      toastError("This school does not have a registration ID assigned.");
      return;
    }
    
    setWaModalData({
      phone: school.whatsapp || school.contact || '',
      message: getWhatsAppMessage(school, regId),
      schoolName: school.name,
      registrationId: regId
    });
  };

  // Fetch global config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRef = doc(db, 'configs', 'global');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setMaxSchoolsLimit(configSnap.data().maxSchoolsLimit || 15);
        } else {
          // Initialize if not exists
          await setDoc(configRef, { maxSchoolsLimit: 15 });
        }
      } catch (err) {
        console.error("Error fetching config: ", err);
      }
    };
    fetchConfig();
  }, []);

  // Handle max schools limit change
  const handleSaveLimit = async () => {
    if (!isAdmin) {
      toastError("You do not have permission to change this setting.");
      return;
    }
    setIsSavingLimit(true);
    try {
      const configRef = doc(db, 'configs', 'global');
      await setDoc(configRef, { 
        maxSchoolsLimit,
        updatedBy: user?.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      success('Maximum school limit updated and saved!');
    } catch (err: any) {
      console.error("Error saving limit: ", err);
      toastError(`Failed to save limit: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingLimit(false);
    }
  };

  // Handle adding a new arrival slot
  const handleAddArrivalSlot = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSlotTime.trim()) return;
    try {
      await addDoc(collection(db, 'arrivalSlots'), {
        time: newSlotTime.trim(),
        capacity: 9999, // Unused/unlimited capacity
        currentCount: 0
      });
      setNewSlotTime('');
      success('Arrival slot successfully created!');
    } catch (err) {
      console.error("Error adding arrival slot: ", err);
      toastError("Failed to add arrival slot.");
    }
  };

  // Handle deleting an arrival slot
  const handleDeleteArrivalSlot = async (slotId: string, slotTime: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the arrival slot "${slotTime}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'arrivalSlots', slotId));
      success('Arrival slot deleted.');
    } catch (err) {
      console.error("Error deleting slot: ", err);
      toastError("Failed to delete arrival slot.");
    }
  };

  // Trigger Gemini Congestion AI Predictions
  const triggerAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport(null);

    try {
      const response = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schools, arrivalSlots })
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response.json();
      setAiReport(data);
      success('Gemini AI Congestion Analysis completed!');
    } catch (err) {
      console.error(err);
      toastError('AI Server latency detected. Please retry analysis.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Seat Allotment changes
  const handleSeatChange = async (dayId: string, category: string, value: number) => {
    try {
      const dayRef = doc(db, 'eventDays', dayId);
      const targetDay = eventDays.find(d => d.id === dayId);
      if (!targetDay) return;

      const details = targetDay.reservedDetails || { vips: 0, judges: 0, organizers: 0, teachers: 0, media: 0, guests: 0 };
      const updatedDetails = {
        ...details,
        [category]: Number(value)
      };

      const sumReserved = Object.values(updatedDetails).reduce((acc: number, curr: any) => acc + Number(curr), 0);

      await updateDoc(dayRef, {
        reservedDetails: updatedDetails,
        reservedSeats: sumReserved
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Update specific field on EventDay (e.g. name, description, capacity, date, registration status)
  const handleUpdateDayField = async (dayId: string, field: string, value: any) => {
    try {
      const dayRef = doc(db, 'eventDays', dayId);
      await updateDoc(dayRef, {
        [field]: value
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Initiate check-in process (opens modal)
  const initiateCheckIn = (school: School) => {
    setSchoolToCheckIn(school);
    setActualStudents(school.actualStudents || school.expectedStudents || 0);
    setActualTeachers(school.actualTeachers || school.expectedTeachers || 0);
    setIsCheckInModalOpen(true);
    setScannerResult(null);
  };

  // Finalize check-in with actual numbers
  const finalizeCheckIn = async () => {
    if (!schoolToCheckIn) return;
    
    setIsFinalizingCheckIn(true);
    try {
      const isCheckingIn = !schoolToCheckIn.checkedIn;
      const schoolRef = doc(db, 'schools', schoolToCheckIn.id);
      
      await updateDoc(schoolRef, {
        checkedIn: isCheckingIn,
        checkInTime: isCheckingIn ? new Date().toISOString() : null,
        actualStudents: actualStudents,
        actualTeachers: actualTeachers
      });

      // Update arrival slot count
      const matchedSlot = arrivalSlots.find(s => s.time === schoolToCheckIn.arrivalTime);
      if (matchedSlot) {
        const slotRef = doc(db, 'arrivalSlots', matchedSlot.id);
        const diff = isCheckingIn ? 1 : -1;
        await updateDoc(slotRef, {
          currentCount: Math.max(0, (matchedSlot.currentCount || 0) + diff)
        });
      }

      success(`School "${schoolToCheckIn.name}" delegation ${isCheckingIn ? 'checked in' : 'checked out'} successfully!`);
      setIsCheckInModalOpen(false);
      setSchoolToCheckIn(null);
    } catch (err: any) {
      console.error(err);
      toastError(`Check-in failed: ${err.message}`);
    } finally {
      setIsFinalizingCheckIn(false);
    }
  };

  // Solo Student Management Logic
  const handleApproveSolo = async (student: SoloStudent) => {
    try {
      const regId = student.registrationId;
      await updateDoc(doc(db, 'soloStudents', student.id), {
        status: 'approved'
      });

      try {
        await addDoc(collection(db, 'notificationLogs'), {
          schoolName: student.name,
          email: student.email,
          subject: `SciVerse 2K26 Solo Registration APPROVED!`,
          message: `Hello ${student.name}, your solo registration is approved. Your ID is ${regId}.`,
          type: 'approved',
          sentAt: new Date().toISOString()
        });
      } catch (logErr) {
        handleFirestoreError(logErr, OperationType.CREATE, 'notificationLogs');
      }

      success(`Approved solo student: ${student.name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `soloStudents/${student.id}`);
    }
  };

  const handleRejectSolo = async (student: SoloStudent) => {
    if (window.confirm(`Decline solo registration for ${student.name}?`)) {
      try {
        await updateDoc(doc(db, 'soloStudents', student.id), {
          status: 'rejected'
        });
        success(`Rejected: ${student.name}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `soloStudents/${student.id}`);
      }
    }
  };

  const handleDeleteSolo = async (student: SoloStudent) => {
    if (window.confirm(`Permanently delete ${student.name}'s record?`)) {
      try {
        await deleteDoc(doc(db, 'soloStudents', student.id));
        success("Solo student record deleted");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `soloStudents/${student.id}`);
      }
    }
  };

  const handleCheckInSolo = async (student: SoloStudent) => {
    try {
      const isCheckingIn = !student.checkedIn;
      await updateDoc(doc(db, 'soloStudents', student.id), {
        checkedIn: isCheckingIn,
        checkInTime: isCheckingIn ? new Date().toISOString() : null
      });
      success(`${student.name} ${isCheckingIn ? 'checked in' : 'checked out'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `soloStudents/${student.id}`);
    }
  };

  const onSoloQRScan = (data: string) => {
    const student = soloStudents.find(s => s.registrationId === data);
    if (student) {
      if (student.status !== 'approved') {
        toastError('This student registration is not approved yet.');
        return;
      }
      handleCheckInSolo(student);
    } else {
      toastError('Invalid Solo Registration ID');
    }
  };

  const handleTriggerWhatsAppSolo = (student: SoloStudent) => {
    const regId = student.registrationId;
    if (!regId) {
      toastError("This student does not have a registration ID assigned.");
      return;
    }
    
    setWaModalData({
      phone: student.contact || '',
      message: getWhatsAppMessageSolo(student, regId),
      schoolName: student.name,
      registrationId: regId
    });
  };

  const handleResendEmailSolo = async (student: SoloStudent) => {
    const regId = student.registrationId;
    if (!regId) {
      toastError("This student does not have a registration ID assigned.");
      return;
    }
    
    const qrPassUrl = `https://quickchart.io/chart?cht=qr&chl=${regId}&chs=150x150`;
    info(`Sending confirmation email to ${student.email}...`);
    try {
      const res = await fetch('/api/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: student.id,
          name: student.name,
          email: student.email,
          teacherInCharge: student.parentName,
          registrationId: regId,
          qrCodeUrl: qrPassUrl,
          quota: 1,
          preferredDay: student.preferredDay || 'SciVerse Event Track',
          arrivalTime: student.arrivalTime || 'To Be Scheduled',
          isSolo: true
        }),
      });
      const data = await res.json();
      if (data.success) {
        success(`Confirmation email sent successfully to ${student.email}!`);
      } else {
        toastError(`Failed to send email: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      toastError("Network error sending confirmation email.");
    }
  };

  // Check in school with input string (Registration ID, e.g. SV26-1234, or document ID)
  const handleScannerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setScannerResult(null);

    const input = scannerInput.trim();
    if (!input) return;

    // Search for school matching registrationId or document ID
    const foundSchool = schools.find(s => s.registrationId === input || s.id === input);
    if (foundSchool) {
      initiateCheckIn(foundSchool);
      setScannerInput('');
    } else {
      setScannerResult('No registered school found matching this pass registration ID.');
    }
  };

  // Export all approved schools as CSV
  const handleExportSchoolsCSV = () => {
    const approvedSchools = schools.filter(s => s.status === 'approved');
    if (approvedSchools.length === 0) {
      toastWarning("No approved schools to export.");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Registration ID,School Name,Principal,Teacher in Charge,Contact,Email,Address,Expected Students,Expected Teachers,Preferred Day,Arrival Time,Quota\r\n";
    
    approvedSchools.forEach(s => {
      const row = `"${s.registrationId || ''}","${s.name}","${s.principalName || ''}","${s.teacherInCharge || ''}","${s.contact || ''}","${s.email}","${s.address || ''}",${s.expectedStudents || 0},${s.expectedTeachers || 0},"${s.preferredDay || ''}","${s.arrivalTime || ''}",${s.quota || 0}`;
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SciVerse_2K26_Approved_Schools.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Approved schools exported as CSV!");
  };

  // Export all school attendances as CSV
  const handleExportParticipantsCSV = () => {
    const approvedSchools = schools.filter(s => s.status === 'approved');
    if (approvedSchools.length === 0) {
      toastWarning("No approved school delegations to export.");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Registration ID,School Name,Expected Students,Expected Teachers,Total Attendance,Preferred Day,Arrival Time,Checked In,Check-In Time\r\n";
    
    approvedSchools.forEach(s => {
      const total = (s.expectedStudents || 0) + (s.expectedTeachers || 0);
      const row = `"${s.registrationId || ''}","${s.name}",${s.expectedStudents || 0},${s.expectedTeachers || 0},${total},"${s.preferredDay || ''}","${s.arrivalTime || ''}","${s.checkedIn ? 'YES' : 'NO'}","${s.checkInTime || ''}"`;
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SciVerse_2K26_Master_Attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Master attendance sheet exported as CSV!");
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    const emailToAdd = newAdminEmail.trim().toLowerCase();
    if (!emailToAdd) return;
    if (emailToAdd === "rameshnathankaruvoolan10@gmail.com") {
      toastWarning("This is the super admin email and is always active.");
      return;
    }
    try {
      await setDoc(doc(db, 'admins', emailToAdd), {
        addedBy: user?.email || 'system',
        addedAt: new Date().toISOString()
      });
      setNewAdminEmail('');
      success(`Admin with email "${emailToAdd}" successfully added.`);
    } catch (err) {
      console.error(err);
      toastError("Error adding admin. Make sure you have database permissions.");
    }
  };

  const handleDeleteAdmin = async (emailToDelete: string) => {
    if (window.confirm(`Are you sure you want to remove ${emailToDelete} from the admin team?`)) {
      try {
        await deleteDoc(doc(db, 'admins', emailToDelete));
        success(`Admin with email "${emailToDelete}" has been removed.`);
      } catch (err) {
        console.error(err);
        toastError("Error removing admin.");
      }
    }
  };

  const approvedSchools = schools.filter(s => s.status === 'approved');
  const approvedSchoolsCount = approvedSchools.length;
  const pendingSchools = schools.filter(s => s.status === 'pending');

  const approvedSolo = soloStudents.filter(s => s.status === 'approved');
  const approvedSoloCount = approvedSolo.length;
  const pendingSolo = soloStudents.filter(s => s.status === 'pending');

  const totalExpectedStudents = approvedSchools.reduce((acc, s) => acc + (s.expectedStudents || 0), 0);
  const totalExpectedTeachers = approvedSchools.reduce((acc, s) => acc + (s.expectedTeachers || 0), 0);
  const totalExpectedAttendees = totalExpectedStudents + totalExpectedTeachers + approvedSoloCount;

  const checkedInSchools = approvedSchools.filter(s => s.checkedIn);
  const checkedInStudents = checkedInSchools.reduce((acc, s) => acc + (s.actualStudents !== undefined ? s.actualStudents : (s.expectedStudents || 0)), 0);
  const checkedInTeachers = checkedInSchools.reduce((acc, s) => acc + (s.actualTeachers !== undefined ? s.actualTeachers : (s.expectedTeachers || 0)), 0);
  const checkedInSoloCount = approvedSolo.filter(s => s.checkedIn).length;
  const checkedInAttendees = checkedInStudents + checkedInTeachers + checkedInSoloCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden relative">
      {/* Background radial overlays */}
      <div className="absolute top-20 right-10 w-[450px] h-[450px] bg-blue-600/5 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-20 left-10 w-[350px] h-[350px] bg-indigo-600/5 rounded-full filter blur-[100px] pointer-events-none"></div>

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 relative z-10">
        
        {/* CONSOLE STATUS BOARD */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-500 animate-pulse" />
              Organizer Control Center
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-wide uppercase">
              Super Admin Control Panel • rameshnathankaruvoolan10@gmail.com
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button 
              onClick={handleExportSchoolsCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-300 transition cursor-pointer"
              title="Export approved schools list"
            >
              <Download className="w-3.5 h-3.5" /> Export Schools
            </button>
            <button 
              onClick={handleExportParticipantsCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-mono font-bold text-white transition cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
              title="Export master attendance sheet of all school delegations"
            >
              <Download className="w-3.5 h-3.5" /> Master Attendance
            </button>

            {/* APPROVED SCHOOLS LIMIT INPUT */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Max Schools Capacity</span>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number"
                  value={maxSchoolsLimit}
                  onChange={e => setMaxSchoolsLimit(Number(e.target.value))}
                  className="w-12 bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-center font-mono font-bold"
                />
                <button
                  onClick={handleSaveLimit}
                  disabled={isSavingLimit}
                  className="p-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition cursor-pointer"
                  title="Save Limit"
                >
                  {isSavingLimit ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS BENTO GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-mono block mb-1">Approved Delegations</span>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {approvedSchoolsCount}<span className="text-xs text-slate-500">/{maxSchoolsLimit} max</span>
            </h3>
            <div className="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${(approvedSchoolsCount / maxSchoolsLimit) * 100}%` }}></div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-mono block mb-1">Total Expected Attendees</span>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {totalExpectedAttendees}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">
              {totalExpectedStudents} Students • {totalExpectedTeachers} Teachers • {approvedSoloCount} Solo
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-mono block mb-1">Live Gate Ingress</span>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-green-400">
              {checkedInAttendees}<span className="text-xs text-slate-500"> arrived</span>
            </h3>
            <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">
              {checkedInSchools.length} Schools • {checkedInSoloCount} Solo present
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-mono block mb-1">Waitlist Pipeline</span>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-yellow-500">
              {pendingSchools.length + pendingSolo.length}
            </h3>
            <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">
              {pendingSchools.length} Schools • {pendingSolo.length} Solo awaiting
            </p>
          </div>
        </div>

        {/* TABS CONTROLLER */}
        <div className="relative mb-6">
          {/* Mobile Dropdown Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-xs font-bold font-mono uppercase tracking-wider text-blue-400"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                {activeTab === 'approvals' && `Approvals Queue (${pendingSchools.length})`}
                {activeTab === 'passes' && `School QR Passes (${schools.filter(s => s.status === 'approved').length})`}
                {activeTab === 'capacities' && 'Seating & Capacities'}
                {activeTab === 'checkin' && 'Gate Check-In'}
                {activeTab === 'predictions' && 'Gemini Congestion AI'}
                {activeTab === 'logs' && 'Notification Logs'}
                {activeTab === 'admins' && 'Admin Management'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl backdrop-blur-xl"
                >
                  {[
                    { id: 'approvals', label: `Approvals Queue (${pendingSchools.length})` },
                    { id: 'soloStudents', label: `Solo Students (${soloStudents.filter(s => s.status === 'pending').length} New)` },
                    { id: 'passes', label: `School QR Passes (${schools.filter(s => s.status === 'approved').length})` },
                    { id: 'capacities', label: 'Seating & Capacities' },
                    { id: 'checkin', label: 'Gate Check-In' },
                    { id: 'predictions', label: 'Gemini Congestion AI' },
                    { id: 'logs', label: 'Notification Logs' },
                    { id: 'admins', label: 'Admin Management' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold font-mono uppercase tracking-wider transition-colors ${
                        activeTab === tab.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:flex gap-2 border-b border-white/10 pb-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'approvals' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Approvals Queue ({pendingSchools.length})
            </button>

            <button
              onClick={() => setActiveTab('soloStudents')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'soloStudents' ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Solo Students ({soloStudents.filter(s => s.status === 'pending').length})
            </button>

            <button
              onClick={() => setActiveTab('passes')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'passes' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              School QR Passes ({schools.filter(s => s.status === 'approved').length})
            </button>
            
            <button
              onClick={() => setActiveTab('capacities')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'capacities' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Seating & Capacities
            </button>

            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'checkin' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Gate Check-In
            </button>

            <button
              onClick={() => setActiveTab('predictions')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'predictions' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Gemini Congestion AI
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'logs' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Notification Logs
            </button>

            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'admins' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Admin Management
            </button>
          </div>
        </div>

        {/* TABS BODIES */}
        <div className="space-y-6">
          
          {/* TAB 1: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Enrollment Approvals Queue</h3>
                  <p className="text-xs text-slate-400">Approve invitations to auto-allocate quotas and secure registration IDs</p>
                </div>
              </div>

              {pendingSchools.length === 0 ? (
                <div className="text-center py-16 bg-white/5 border border-white/5 rounded-2xl">
                  <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-slate-400">Approvals queue is clear.</p>
                  <p className="text-xs text-slate-500 mt-1">All registered schools have been evaluated.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {pendingSchools.map((s) => (
                    <motion.div 
                      layout
                      key={s.id}
                      className="p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/5 p-1 shrink-0 overflow-hidden">
                              <img src={s.logoUrl} alt="Logo" className="w-full h-full object-cover rounded" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">{s.name}</h4>
                              <p className="text-[10px] text-blue-400 font-mono">{s.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full uppercase">
                              Pending Review
                            </span>
                            <button
                              onClick={() => handleDeleteSchool(s.id, s.name)}
                              className="p-1.5 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Delete School Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 border-t border-b border-white/5 py-2.5">
                          <div>
                            <p className="text-[9px] text-slate-500 font-mono uppercase">ESTIMATED ROSTER</p>
                            <p className="text-white font-semibold font-mono">{s.expectedStudents} Students • {s.expectedTeachers} Teachers</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 font-mono uppercase">PREFERRED DAY</p>
                            <p className="text-white font-semibold truncate">{s.preferredDay}</p>
                          </div>
                        </div>

                        <div className="text-xs space-y-1 text-slate-300 bg-slate-950/40 p-2.5 rounded-xl">
                          <p><span className="text-slate-500">Teacher:</span> {s.teacherInCharge} ({s.contact})</p>
                          <p><span className="text-slate-500">Principal:</span> {s.principalName}</p>
                          {s.specialRequirements && (
                            <p className="text-[11px] text-amber-400 font-mono"><span className="text-slate-500">Special Requirements:</span> {s.specialRequirements}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleReject(s)}
                          className="flex-1 py-2 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleApprove(s)}
                          className="flex-1 py-2 border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer"
                        >
                          Approve Registration
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SOLO STUDENTS */}
          {activeTab === 'soloStudents' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-500" />
                    Solo Student Management
                  </h3>
                  <p className="text-xs text-slate-400">Manage individual student registrations and gate check-ins</p>
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white font-mono"
                  />
                </div>
              </div>

              {/* Internal Solo Tabs - Mobile Dropdown responsive */}
              <div className="relative">
                <div className="md:hidden mb-4">
                  <select 
                    value={soloTab}
                    onChange={(e) => setSoloTab(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold font-mono uppercase text-indigo-400 focus:outline-none"
                  >
                    <option value="pending">Pending ({soloStudents.filter(s => s.status === 'pending').length})</option>
                    <option value="approved">Verified Soloists ({soloStudents.filter(s => s.status === 'approved').length})</option>
                    <option value="rejected">Declined</option>
                    <option value="checkin">Gate Check-In</option>
                  </select>
                </div>
                
                <div className="hidden md:flex gap-6 border-b border-white/10 mb-6">
                  {[
                    { id: 'pending', label: 'Pending Approval', count: soloStudents.filter(s => s.status === 'pending').length },
                    { id: 'approved', label: 'Verified Soloists', count: soloStudents.filter(s => s.status === 'approved').length },
                    { id: 'rejected', label: 'Declined', count: soloStudents.filter(s => s.status === 'rejected').length },
                    { id: 'checkin', label: 'Gate Check-In', count: null }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSoloTab(tab.id as any)}
                      className={`pb-3 text-xs font-bold font-mono uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                        soloTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab.label} {tab.count !== null && <span className="ml-1 opacity-60">({tab.count})</span>}
                    </button>
                  ))}
                </div>
              </div>

              {soloTab === 'checkin' && (
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6 mb-6">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-full md:w-1/3 aspect-square max-w-[240px] bg-slate-950 rounded-2xl border border-white/10 overflow-hidden relative">
                      <QRScanner 
                        onScanSuccess={onSoloQRScan}
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-indigo-400" />
                        Gate Scanner (Solo Students)
                      </h4>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        Position the solo student's digital or printed pass within the camera frame. 
                        The system will automatically verify registration status and record check-in time.
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] text-slate-300 font-mono uppercase">Authorized Entry Mode Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {soloStudents
                  .filter(s => {
                    if (soloTab === 'checkin') return s.status === 'approved';
                    return s.status === soloTab;
                  })
                  .filter(s => {
                    const q = searchQuery.toLowerCase();
                    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.registrationId?.toLowerCase().includes(q);
                  })
                  .map(student => (
                    <motion.div
                      layout
                      key={student.id}
                      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-indigo-500/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <h3 className="font-bold text-white text-lg">{student.name}</h3>
                            <p className="text-xs text-indigo-400 font-mono">{student.registrationId || 'PENDING ID'}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteSolo(student)}
                            className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2 text-[11px] text-slate-400 mb-4">
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span>School:</span>
                            <span className="text-white font-medium truncate max-w-[150px]">{student.school}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span>Grade:</span>
                            <span className="text-white font-medium">{student.grade}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span>Guardian:</span>
                            <span className="text-white font-medium">{student.parentName}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span>Preferred Day:</span>
                            <span className="text-indigo-400 font-medium">{student.preferredDay}</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/50 p-3 rounded-xl space-y-1.5 mb-4 border border-white/5">
                          <div className="flex items-center gap-2 text-[10px] text-slate-300 truncate">
                            <Mail className="w-3 h-3 text-indigo-400" />
                            {student.email}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-300">
                            <Phone className="w-3 h-3 text-indigo-400" />
                            {student.contact}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {soloTab === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleRejectSolo(student)}
                              className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                            >
                              Decline
                            </button>
                            <button 
                              onClick={() => handleApproveSolo(student)}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold font-mono uppercase transition cursor-pointer"
                            >
                              Verify & Approve
                            </button>
                          </>
                        )}

                        {soloTab === 'approved' && (
                          <div className="w-full space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleTriggerWhatsAppSolo(student)}
                                className="py-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-slate-950 rounded-xl text-[10px] font-bold font-mono uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 shrink-0" /> WhatsApp
                              </button>
                              <button
                                onClick={() => handleResendEmailSolo(student)}
                                className="py-2 bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 text-blue-400 hover:text-white rounded-xl text-[10px] font-bold font-mono uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5 shrink-0" /> Email Pass
                              </button>
                            </div>
                            <div className="w-full flex items-center justify-center p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold font-mono uppercase">
                              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verified Participant
                            </div>
                          </div>
                        )}

                        {soloTab === 'checkin' && (
                          <button 
                            onClick={() => handleCheckInSolo(student)}
                            className={`w-full py-3 rounded-xl text-xs font-bold font-mono uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
                              student.checkedIn 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {student.checkedIn ? (
                              <><ShieldCheck className="w-4 h-4" /> Checked In</>
                            ) : (
                              <><QrCode className="w-4 h-4" /> Authorize Entry</>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>
              
              {soloStudents.filter(s => {
                if (soloTab === 'checkin') return s.status === 'approved';
                return s.status === soloTab;
              }).length === 0 && (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
                  <AlertTriangle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 font-mono text-sm uppercase">No students found in this category.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: SCHOOL QR PASSES */}
          {activeTab === 'passes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">School Delegation QR Passes</h3>
                  <p className="text-xs text-slate-400">View, copy, and download stylish registration credentials for verified schools</p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text"
                    placeholder="Search by school or Reg ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-white font-mono"
                  />
                </div>
              </div>

              {schools.filter(s => s.status === 'approved').length === 0 ? (
                <div className="text-center py-16 bg-white/5 border border-white/5 rounded-2xl">
                  <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-slate-400 font-mono uppercase tracking-wider">No approved schools found.</p>
                  <p className="text-xs text-slate-500 mt-1">Approve registered schools from the queue to generate QR passes.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schools
                    .filter(s => s.status === 'approved')
                    .filter(s => {
                      const queryStr = `${s.name} ${s.registrationId || ''} ${s.email}`.toLowerCase();
                      return queryStr.includes(searchQuery.toLowerCase());
                    })
                    .map((s) => (
                      <div key={s.id} className="space-y-2.5 flex flex-col justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <SchoolPassCard 
                          school={{
                            id: s.id,
                            name: s.name,
                            registrationId: s.registrationId,
                            teacherInCharge: s.teacherInCharge,
                            teacherInChargeEmail: s.teacherInChargeEmail,
                            teacherInChargePhone: s.teacherInChargePhone,
                            principalName: s.principalName,
                            email: s.email,
                            contact: s.contact,
                            whatsapp: s.whatsapp,
                            preferredDay: s.preferredDay,
                            arrivalTime: s.arrivalTime,
                            expectedStudents: Number(s.expectedStudents || 0),
                            expectedTeachers: Number(s.expectedTeachers || 0),
                            status: 'approved'
                          }} 
                        />
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleTriggerWhatsApp(s)}
                            className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-slate-950 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Open WhatsApp manual dispatcher with styled invitation text"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" /> WhatsApp
                          </button>
                          
                          <button
                            onClick={() => handleResendEmail(s)}
                            className="py-2.5 bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 text-blue-400 hover:text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Resend gorgeous official registration HTML confirmation email"
                          >
                            <Mail className="w-3.5 h-3.5 shrink-0" /> Email Pass
                          </button>
                        </div>

                        <button
                          onClick={() => handleDeleteSchool(s.id, s.name)}
                          className="w-full py-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Delegation
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CAPACITIES */}
          {activeTab === 'capacities' && (
            <div className="grid lg:grid-cols-12 gap-8">
              
              {/* SEATING ALLOCATIONS */}
              <div className="lg:col-span-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Event Seating Allocations</h3>
                  <p className="text-xs text-slate-400">Configure safety thresholds and reserve seating bounds for days</p>
                </div>

                <div className="space-y-6">
                  {eventDays.map((day) => {
                    const rDetails = day.reservedDetails || { vips: 0, judges: 0, organizers: 0, teachers: 0, media: 0, guests: 0 };
                    return (
                      <div key={day.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <div>
                            <h4 className="font-bold text-white text-sm">{day.name}</h4>
                            <p className="text-[10px] text-blue-400 font-mono">{day.date}</p>
                          </div>
                          <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded font-bold">
                            Total: {day.capacity} Seats
                          </span>
                        </div>

                        {/* CONFIG GRID */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">VIPs</label>
                            <input 
                              type="number"
                              value={rDetails.vips}
                              onChange={e => handleSeatChange(day.id, 'vips', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Judges</label>
                            <input 
                              type="number"
                              value={rDetails.judges}
                              onChange={e => handleSeatChange(day.id, 'judges', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Organizers</label>
                            <input 
                              type="number"
                              value={rDetails.organizers}
                              onChange={e => handleSeatChange(day.id, 'organizers', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Teachers</label>
                            <input 
                              type="number"
                              value={rDetails.teachers}
                              onChange={e => handleSeatChange(day.id, 'teachers', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Media</label>
                            <input 
                              type="number"
                              value={rDetails.media}
                              onChange={e => handleSeatChange(day.id, 'media', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Guests</label>
                            <input 
                              type="number"
                              value={rDetails.guests}
                              onChange={e => handleSeatChange(day.id, 'guests', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-slate-400 bg-slate-950/30 p-2.5 rounded-xl border border-white/5">
                          <span>Reserved Allocation ceiling: <strong className="text-white font-mono">{day.reservedSeats} Seats</strong></span>
                          <span>General Student Seats available: <strong className="text-blue-400 font-mono">{day.capacity - day.reservedSeats} Seats</strong></span>
                        </div>

                        {/* EDITABLE METADATA & POSTER DESCRIPTION */}
                        <div className="border-t border-white/5 pt-4 space-y-3">
                          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block font-bold">Metadata & Poster Description</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Day Title / Theme</label>
                              <input 
                                type="text"
                                value={day.name}
                                onChange={e => handleUpdateDayField(day.id, 'name', e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Date</label>
                              <input 
                                type="date"
                                value={day.date}
                                onChange={e => handleUpdateDayField(day.id, 'date', e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">General Capacity</label>
                              <input 
                                type="number"
                                value={day.capacity}
                                onChange={e => handleUpdateDayField(day.id, 'capacity', Number(e.target.value))}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Poster-Based Description</label>
                            <textarea 
                              rows={2}
                              value={day.description || ''}
                              onChange={e => handleUpdateDayField(day.id, 'description', e.target.value)}
                              placeholder="Describe this day's practical campaigns, experiments, and schedule to match the poster design..."
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              id={`reg-open-${day.id}`}
                              checked={day.isOpenForRegistration !== false}
                              onChange={e => handleUpdateDayField(day.id, 'isOpenForRegistration', e.target.checked)}
                              className="w-4 h-4 rounded border-white/10 bg-slate-900 focus:ring-blue-500 text-blue-600"
                            />
                            <label htmlFor={`reg-open-${day.id}`} className="text-xs text-slate-300 font-medium select-none cursor-pointer">
                              Active: Open for delegate RSVPs & registrations on this day
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ARRIVAL TIMETABLE QUEUES */}
              <div className="lg:col-span-4 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Time of Arrivals Manager</h3>
                  <p className="text-xs text-slate-400 font-mono">Create, delete, and monitor gate arrival timelines</p>
                </div>

                {/* ADD NEW ARRIVAL SLOT */}
                <form onSubmit={handleAddArrivalSlot} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 backdrop-blur-md">
                  <label className="block text-xs font-bold text-slate-300 font-mono uppercase">Add New Arrival Time</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="e.g. 11:00 AM - 11:30 AM"
                      value={newSlotTime}
                      onChange={e => setNewSlotTime(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                    />
                    <button 
                      type="submit"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono transition shrink-0 cursor-pointer"
                    >
                      ADD
                    </button>
                  </div>
                </form>

                <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md max-h-[480px] overflow-y-auto custom-scrollbar">
                  {arrivalSlots.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-mono">
                      No arrival times defined yet. Use the form above to add one.
                    </div>
                  ) : (
                    arrivalSlots.map((slot) => {
                      const matchedSchoolsCount = schools.filter(s => s.arrivalTime === slot.time && s.status === 'approved').length;
                      const estimatedLoad = schools
                        .filter(s => s.arrivalTime === slot.time && s.status === 'approved')
                        .reduce((acc, curr) => acc + (curr.expectedStudents || 0) + (curr.expectedTeachers || 0), 0);

                      return (
                        <div key={slot.id} className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <span className="font-bold text-xs text-white block truncate">{slot.time}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-blue-400 font-mono">
                                {matchedSchoolsCount} {matchedSchoolsCount === 1 ? 'School' : 'Schools'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">•</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {estimatedLoad} Attendees
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteArrivalSlot(slot.id, slot.time)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-lg transition shrink-0 cursor-pointer"
                            title="Delete Arrival Time"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GATE CHECK-IN */}
          {activeTab === 'checkin' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              
              {/* MAIN INGRESS SCANNER */}
              <div className="lg:col-span-4 space-y-4 lg:space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 lg:p-6 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 lg:w-4.5 lg:h-4.5 text-blue-500 animate-pulse" /> Gate Entry Scanner
                  </h3>
                  <p className="text-[11px] lg:text-xs text-slate-400">Scan Master Pass QR or enter Registration ID manually.</p>

                  <form onSubmit={handleScannerSubmit} className="space-y-3">
                    <QRScanner onScanSuccess={(text) => {
                      setScannerInput(text);
                      const foundSchool = schools.find(s => s.registrationId === text || s.id === text);
                      const foundSolo = soloStudents.find(s => s.registrationId === text || s.id === text);
                      
                      if (foundSchool) {
                        initiateCheckIn(foundSchool);
                        setScannerInput('');
                      } else if (foundSolo) {
                        // For solo students, check-in is just a toggle
                        handleCheckInSolo(foundSolo);
                        setScannerInput('');
                        setScannerResult(`Solo student ${foundSolo.name} processed successfully.`);
                      }
                    }} />
                    
                    <div className="flex items-center gap-2 my-2">
                      <div className="h-px bg-white/10 flex-1"></div>
                      <span className="text-[9px] text-slate-500 font-mono uppercase">OR MANUALLY</span>
                      <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 uppercase font-mono mb-1">REGISTRATION ID</label>
                      <input 
                        type="text"
                        placeholder="SV26-xxxx"
                        value={scannerInput}
                        onChange={e => setScannerInput(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer"
                    >
                      Authorize & Check In
                    </button>
                  </form>

                  {scannerResult && (
                    <div className={`p-3 rounded-xl border text-[11px] font-mono ${
                      scannerResult.includes('successfully') 
                        ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      {scannerResult}
                    </div>
                  )}
                </div>

                {/* OFFICIAL GATE INGRESS PROTOCOLS */}
                <div className="p-3 lg:p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-2 text-[10px] lg:text-xs text-slate-400 leading-relaxed">
                  <p className="font-bold text-white font-mono flex items-center gap-1"><ShieldCheck className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-blue-400" /> PROTOCOLS:</p>
                  <p>1. Scan the delegation's official Master Pass QR code.</p>
                  <p>2. Verify attendance size before checking in.</p>
                </div>
              </div>

              {/* INTERACTIVE SECURITY GATE MANIFEST */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base lg:text-lg font-bold text-white">Gate Entry Manifest</h3>
                    <p className="text-[11px] lg:text-xs text-slate-400">Search and toggle school delegation status</p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      placeholder="Search school name or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide border border-white/10 rounded-xl bg-white/5 backdrop-blur-md max-h-[400px] lg:max-h-[450px]">
                  <table className="w-full text-left border-collapse text-[11px] lg:text-xs min-w-[650px]">
                    <thead>
                      <tr className="text-[9px] lg:text-[10px] text-slate-500 font-mono uppercase tracking-widest border-b border-white/5 bg-slate-900/40">
                        <th className="py-2.5 px-3">School Name</th>
                        <th className="py-2.5 px-3">Arrival Schedule</th>
                        <th className="py-2.5 px-3 text-center">Allotment</th>
                        <th className="py-2.5 px-3">Master ID</th>
                        <th className="py-2.5 px-3 text-right">Gate Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        ...schools.filter(s => s.status === 'approved').map(s => ({ ...s, isSolo: false })),
                        ...soloStudents.filter(s => s.status === 'approved').map(s => ({ ...s, isSolo: true }))
                      ]
                        .filter(s => {
                          const combinedString = `${s.name} ${s.registrationId || ''} ${s.email} ${s.isSolo ? 'solo' : 'school'}`.toLowerCase();
                          return combinedString.includes(searchQuery.toLowerCase());
                        })
                        .map(s => {
                          const ticketKey = s.registrationId || s.id;
                          const totalAllotment = s.isSolo ? 1 : (Number(s.expectedStudents || 0) + Number(s.expectedTeachers || 0));
                          
                          return (
                            <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                              <td className="py-2 px-3 font-semibold text-white max-w-[150px] truncate">
                                {s.name}
                                {s.isSolo && <span className="ml-2 text-[8px] bg-indigo-500/20 text-indigo-400 px-1 rounded uppercase font-mono">Solo</span>}
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-slate-300 block text-[10px]">{s.preferredDay || 'TBD'}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{s.arrivalTime || 'TBD'}</span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex flex-col">
                                  <span className="text-blue-400 font-bold">{totalAllotment}</span>
                                  <span className="text-[8px] text-slate-500 uppercase font-mono">{s.isSolo ? 'Individual' : 'Delegation'}</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-white/5">{ticketKey}</span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                {s.isSolo ? (
                                  <button
                                    onClick={() => handleCheckInSolo(s as unknown as SoloStudent)}
                                    className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition cursor-pointer ${
                                      s.checkedIn 
                                        ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400' 
                                        : 'bg-white/5 text-slate-400 hover:bg-green-600 hover:text-white'
                                    }`}
                                  >
                                    {s.checkedIn ? '✓ Arrived' : 'Inbound'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => initiateCheckIn(s as unknown as School)}
                                    className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition cursor-pointer ${
                                      s.checkedIn 
                                        ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400' 
                                        : 'bg-white/5 text-slate-400 hover:bg-green-600 hover:text-white'
                                    }`}
                                  >
                                    {s.checkedIn ? '✓ Arrived' : 'Inbound'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI CONGESTION PREDICTIONS */}
          {activeTab === 'predictions' && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-5 h-5 text-blue-400" />
                    Gemini Traffic Capacity Forecasting
                  </h3>
                  <p className="text-xs text-slate-400">Consult Gemini AI models to analyze school registration timetables and prevent gate congestion</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={triggerAiAnalysis}
                  disabled={isAiLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" /> {isAiLoading ? 'Evaluating timelines...' : 'Run Gemini Bottleneck Forecast'}
                </motion.button>
              </div>

              <AnimatePresence mode="wait">
                {isAiLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-12 text-center bg-white/5 border border-white/5 rounded-2xl space-y-4"
                  >
                    <div className="w-12 h-12 border-t-2 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-400 font-mono">Running neural congestion analysis on school RSVP queues...</p>
                  </motion.div>
                )}

                {aiReport && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid md:grid-cols-12 gap-6"
                  >
                    
                    {/* RECOMMENDATIONS SUMMARY */}
                    <div className="md:col-span-8 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-md">
                      <h4 className="text-sm font-bold text-white font-mono uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4.5 h-4.5" /> Commitee Action Directives
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/40 p-4 rounded-xl border border-white/5">
                        {aiReport.predictions}
                      </p>
                    </div>

                    {/* BOTTLENECK FORECAST METRICS */}
                    <div className="md:col-span-4 space-y-6">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3.5 backdrop-blur-md">
                        <h4 className="text-xs font-bold font-mono text-blue-400 uppercase tracking-wider">Bottleneck Indicators</h4>
                        
                        <div className="space-y-3 text-xs text-slate-300">
                          <div className="flex justify-between border-b border-white/5 pb-1.5">
                            <span>Peak Bottleneck Day</span>
                            <span className="font-bold text-white">{aiReport.bottleneckDay || 'Day 2 - Exhibitions & Practical Labs (July 23)'}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1.5">
                            <span>High-Congestion Hour</span>
                            <span className="font-bold text-red-400">{aiReport.bottleneckTime || '08:30 AM - 09:00 AM'}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1.5">
                            <span>Estimated Peak Queue</span>
                            <span className="font-mono text-white font-bold">{aiReport.expectedPeakQueue || '140+ people'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Security Ingress Risk</span>
                            <span className="font-mono text-yellow-400 font-bold uppercase">{aiReport.mitigationUrgency || 'MEDIUM'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">System Notification Logs</h3>
                <p className="text-xs text-slate-400">Review email notification triggers sent during approvals, updates, and invitations</p>
              </div>

              <div className="space-y-3 border border-white/10 rounded-xl bg-white/5 p-4 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8 font-mono">No notifications logged yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-950/60 border border-white/5 rounded-xl space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-slate-400 flex-wrap gap-2 text-[10px]">
                        <span>School: <strong className="text-white">{log.schoolName}</strong> ({log.email})</span>
                        <span>{new Date(log.sentAt).toLocaleString()}</span>
                      </div>
                      <h4 className="font-bold text-blue-400">{log.subject}</h4>
                      <p className="text-slate-300 leading-relaxed font-sans">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ADMIN MANAGEMENT */}
          {activeTab === 'admins' && (
            <div className="grid lg:grid-cols-12 gap-8">
              
              {/* AUTHORIZE NEW ADMIN */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400 flex items-center gap-1.5">
                    <Shield className="w-4.5 h-4.5 text-blue-500 animate-pulse" /> Authorize New Administrator
                  </h3>
                  <p className="text-xs text-slate-400">
                    Grant administrative privileges to a team member by adding their Gmail address. They will be able to access this control center, approve schools, configure timings, and perform scans.
                  </p>

                  <form onSubmit={handleAddAdmin} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">GMAIL ADDRESS</label>
                      <input 
                        type="email"
                        required
                        placeholder="e.g. co-organizer@gmail.com"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs font-mono text-white"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" /> Authorize Admin Access
                    </button>
                  </form>
                </div>

                <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-2 text-xs text-slate-400 leading-relaxed">
                  <p className="font-bold text-white font-mono flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-400" /> PRIVILEGES NOTICE:</p>
                  <p>1. Authorized admins must log in via the "Admin Console / Register" using their Google account.</p>
                  <p>2. To preserve platform ownership integrity, the super admin account cannot be deleted or modified.</p>
                </div>
              </div>

              {/* ADMINS DIRECTORY */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Administrator Team Directory</h3>
                  <p className="text-xs text-slate-400">Active personnel authorized with access permissions</p>
                </div>

                <div className="overflow-x-auto border border-white/10 rounded-xl bg-white/5 backdrop-blur-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-[10px] text-slate-500 font-mono uppercase tracking-widest border-b border-white/5 bg-slate-900/40">
                        <th className="py-3 px-4">Admin Email</th>
                        <th className="py-3 px-4">Role Designation</th>
                        <th className="py-3 px-4">Authorized By</th>
                        <th className="py-3 px-4 text-right">Revoke Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {/* ALWAYS DISPLAY ROOT SUPER ADMIN FIRST */}
                      <tr className="bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></div>
                          rameshnathankaruvoolan10@gmail.com
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-blue-500/15 text-blue-400 text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border border-blue-500/20">
                            Root / Super Admin
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">System Built-in</td>
                        <td className="py-3.5 px-4 text-right">
                          <button 
                            disabled
                            className="p-1.5 bg-white/5 text-slate-600 rounded-lg cursor-not-allowed border border-white/5"
                            title="Root Administrator access cannot be revoked"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {admins.map(adm => (
                        <tr key={adm.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-200">{adm.email}</td>
                          <td className="py-3.5 px-4">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Co-Administrator
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px] truncate max-w-[120px]" title={adm.addedBy}>
                            {adm.addedBy || 'Admin'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button 
                              onClick={() => handleDeleteAdmin(adm.id)}
                              className="p-1.5 bg-white/5 hover:bg-red-500/15 hover:text-red-400 text-slate-400 rounded-lg border border-white/5 transition cursor-pointer"
                              title="Revoke admin privileges"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </main>

      {/* WhatsApp Manual Notification Dispatcher Modal */}
      <AnimatePresence>
        {waModalData && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <QrCode className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Registration Approved!</h3>
                    <p className="text-xs text-slate-400">For {waModalData.schoolName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setWaModalData(null)}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/10 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed">
                ✨ <strong>Notification Status:</strong> An automated, styled HTML confirmation email has been dispatched to the school delegation contact address.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Verify School WhatsApp Number</label>
                  <input
                    type="text"
                    value={waModalData.phone}
                    onChange={e => setWaModalData({ ...waModalData, phone: e.target.value })}
                    placeholder="Enter phone with country code, e.g. +94771234567"
                    className="w-full bg-slate-950 border border-white/10 focus:border-green-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Make sure to include country code without symbols (e.g. 94 for Sri Lanka).</p>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Preview WhatsApp Message</label>
                  <textarea
                    rows={8}
                    value={waModalData.message}
                    onChange={e => setWaModalData({ ...waModalData, message: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 focus:border-green-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-300 font-sans leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setWaModalData(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    const cleanPhone = waModalData.phone.replace(/[^0-9]/g, '');
                    const encodedMsg = encodeURIComponent(waModalData.message);
                    window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                    setWaModalData(null);
                  }}
                  className="flex-[2] py-3 bg-green-500 hover:bg-green-600 text-slate-950 font-bold rounded-xl text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-500/10"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.019-5.111-2.875-6.968-1.857-1.858-4.331-2.88-6.969-2.881-5.441 0-9.866 4.42-9.87 9.858a9.816 9.816 0 001.472 5.004l-.969 3.537 3.633-.953zM18.23 15.34c-.34-.17-2.01-1-2.316-1.11-.312-.112-.538-.17-.764.17-.225.337-.872 1.1-.1.17.653-.762.653-.87.423-.337-.226-.113-1.638-.602-3.118-1.92-1.15-1.025-1.926-2.29-2.152-2.627-.226-.337-.024-.52.146-.689.153-.153.339-.395.509-.593.17-.198.226-.339.339-.565.113-.226.056-.424-.028-.593-.085-.17-.763-1.838-1.045-2.518-.276-.665-.554-.575-.762-.585-.198-.01-.424-.01-.65-.01-.226 0-.593.085-.904.424-.311.339-1.187 1.159-1.187 2.827s1.215 3.279 1.385 3.505c.17.227 2.39 3.651 5.79 5.121.808.349 1.44.558 1.93.714.811.258 1.55.221 2.13.136.65-.098 2.01-.822 2.29-1.583.284-.763.284-1.414.2-1.55-.084-.136-.311-.225-.65-.395z" />
                  </svg>
                  Send via WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GATE CHECK-IN VERIFICATION MODAL */}
      <AnimatePresence>
        {isCheckInModalOpen && schoolToCheckIn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckInModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-blue-400" /> Gate Verification
                    </h3>
                    <p className="text-sm text-slate-400">Confirm delegation credentials</p>
                  </div>
                  <button 
                    onClick={() => setIsCheckInModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-500 uppercase font-mono">School</span>
                    <span className="text-sm font-bold text-white text-right">{schoolToCheckIn.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 uppercase font-mono">Principal</span>
                    <span className="text-[11px] font-medium text-slate-300 text-right">{schoolToCheckIn.principalName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-500 uppercase font-mono">Teacher In Charge</span>
                    <span className="text-[11px] font-medium text-slate-300 text-right">{schoolToCheckIn.teacherInCharge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 uppercase font-mono">Reg ID</span>
                    <span className="text-xs font-mono text-blue-400">{schoolToCheckIn.registrationId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 uppercase font-mono">Expected Students</span>
                    <span className="text-sm font-bold text-white">{schoolToCheckIn.expectedStudents}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Actual Attendance</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Actual Students</label>
                      <input 
                        type="number"
                        value={actualStudents}
                        onChange={e => setActualStudents(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Actual Teachers</label>
                      <input 
                        type="number"
                        value={actualTeachers}
                        onChange={e => setActualTeachers(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsCheckInModalOpen(false)}
                    className="flex-1 py-3 border border-white/10 text-slate-300 font-bold rounded-xl text-xs font-mono uppercase transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={finalizeCheckIn}
                    disabled={isFinalizingCheckIn}
                    className={`flex-[2] py-3 font-bold rounded-xl text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                      schoolToCheckIn.checkedIn
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    }`}
                  >
                    {isFinalizingCheckIn ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : schoolToCheckIn.checkedIn ? (
                      'Check Out Delegation'
                    ) : (
                      'Authorize Check-In'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RobotAssistant />
    </div>
  );
}
