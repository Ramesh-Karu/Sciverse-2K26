import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, getDocs, deleteDoc, addDoc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { School, Participant, EventDay, ArrivalSlot, NotificationLog, SoloStudent, FeedbackReview } from '../types';
import Navbar from '../components/Navbar';
import RobotAssistant from '../components/RobotAssistant';
import { SchoolPassCard, CardSchoolData } from '../components/StylishCardGenerator';
import QRScanner from '../components/QRScanner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Check, X, Shield, Calendar, Users, UserMinus, Cpu, FileText, 
  Settings, UserCheck, Search, Sliders, Play, TrendingUp, Sparkles, AlertTriangle, RefreshCcw, Download, Trash2, ShieldCheck, QrCode,
  Mail, MessageSquare, ChevronDown, User, Phone, Loader2, MessageCircle, Star
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
  const [reviews, setReviews] = useState<FeedbackReview[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'approvals' | 'passes' | 'capacities' | 'checkin' | 'predictions' | 'logs' | 'admins' | 'soloStudents' | 'reviews'>('approvals');
  const [soloTab, setSoloTab] = useState<'pending' | 'approved' | 'rejected' | 'checkin'>('pending');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxSchoolsLimit, setMaxSchoolsLimit] = useState(15);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Reviews Filters state
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'viewer' | 'teacher'>('all');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<string>('all');
  const [reviewSearchText, setReviewSearchText] = useState<string>('');

  // WhatsApp manual push notification state
  const [waModalData, setWaModalData] = useState<{
    phone: string;
    message: string;
    schoolName: string;
    registrationId: string;
  } | null>(null);

  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waApiError, setWaApiError] = useState<string | null>(null);
  const [waApiSuccess, setWaApiSuccess] = useState<string | null>(null);

  // WAHA Overrides State
  const [wahaUrlOverride, setWahaUrlOverride] = useState(() => localStorage.getItem("waha_url_override") || "");
  const [wahaKeyOverride, setWahaKeyOverride] = useState(() => localStorage.getItem("waha_key_override") || "");
  const [wahaSessionOverride, setWahaSessionOverride] = useState(() => localStorage.getItem("waha_session_override") || "");
  const [showWahaSettings, setShowWahaSettings] = useState(false);

  // SMTP Settings State
  const [smtpConfig, setSmtpConfig] = useState<any>({
    host: '',
    port: '587',
    secure: false,
    user: '',
    pass: '',
    resendApiKey: '',
    senderEmail: 'noreply@npfp.site',
    senderName: 'SciVerse 2K26'
  });
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [testEmailSuccess, setTestEmailSuccess] = useState<string | null>(null);

  const getWahaHeaders = (baseHeaders: Record<string, string> = {}) => {
    const headers = { ...baseHeaders };
    if (wahaUrlOverride) headers["x-waha-url-override"] = wahaUrlOverride;
    if (wahaKeyOverride) headers["x-waha-key-override"] = wahaKeyOverride;
    if (wahaSessionOverride) headers["x-waha-session-override"] = wahaSessionOverride;
    return headers;
  };

  useEffect(() => {
    if (!waModalData) {
      setIsSendingWa(false);
      setWaApiError(null);
      setWaApiSuccess(null);
    }
  }, [waModalData]);

  const handleSendWaApi = async () => {
    if (!waModalData) return;
    setIsSendingWa(true);
    setWaApiError(null);
    setWaApiSuccess(null);

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: getWahaHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          phone: waModalData.phone,
          message: waModalData.message,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const cleanText = text.replace(/<[^>]*>/g, " ").trim();
        const truncatedText = cleanText.substring(0, 180) + (cleanText.length > 180 ? "..." : "");
        throw new Error(truncatedText || `HTTP ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        if (response.status === 412) {
          setWaApiError("API NOT CONFIGURED: Please define either WAHA API details, Meta Cloud API keys, or Twilio keys in your environment variables.");
        } else {
          setWaApiError(data.error || "Failed to dispatch message via API.");
        }
      } else {
        setWaApiSuccess(`Dispatched successfully via ${data.provider.toUpperCase()} API!`);
      }
    } catch (err) {
      console.error(err);
      setWaApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSendingWa(false);
    }
  };

  const [wahaCheckLoading, setWahaCheckLoading] = useState(false);
  const [wahaStatusData, setWahaStatusData] = useState<{
    success: boolean;
    connected: boolean;
    status: string;
    error?: string;
    wahaApiUrl?: string;
    session?: any;
    allSessions?: any[];
  } | null>(null);

  const handleCheckWahaStatus = async () => {
    setWahaCheckLoading(true);
    setWahaStatusData(null);
    try {
      const response = await fetch("/api/whatsapp/status", {
        headers: getWahaHeaders()
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const cleanText = text.replace(/<[^>]*>/g, " ").trim();
        const truncatedText = cleanText.substring(0, 180) + (cleanText.length > 180 ? "..." : "");
        throw new Error(truncatedText || `HTTP ${response.status} ${response.statusText}`);
      }
      setWahaStatusData(data);
    } catch (err) {
      console.error(err);
      setWahaStatusData({
        success: false,
        connected: false,
        status: "UNREACHABLE",
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setWahaCheckLoading(false);
    }
  };

  const getWhatsAppMessage = (school: School, regId: string) => {
    const preferredDay = school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)';
    const arrivalTime = school.arrivalTime || '08:30 AM - 09:00 AM';
    const portalDirectLink = `https://sujhc.site/?login=${school.id}`;
    
    return `*SciVerse 2K26 Registration Confirmed!* 🚀\nOrganized by: *Science Union, Jaffna Hindu College*\n\nDear *${school.teacherInCharge}*,\n\nWe are thrilled to inform you that the registration for *${school.name}* is officially confirmed! \n\n*Admission & Portal Access:*\n============================\n🎫 *Registration ID:* ${regId}\n📅 *Event Day:* ${preferredDay}\n⏰ *Arrival Time Slot:* ${arrivalTime}\n\n*Download your QR Pass here:*\n============================\n${portalDirectLink}\n\n*Official Updates Group:*\n============================\nJoin the official SciVerse WhatsApp updates group for announcements:\nhttps://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l\n\n*Instructions:*\n1. Click the link above to access your school portal.\n2. From the portal, you can download your QR Entry Pass, manage student rosters, and print ID cards.\n3. Present your Registration ID or QR Pass at the gate for verification.\n\nSee you at the Science Union Exhibition!`;
  };

  const getWhatsAppMessageSolo = (student: SoloStudent, regId: string) => {
    const preferredDay = student.preferredDay || 'SciVerse Event Track';
    const arrivalTime = student.arrivalTime || 'To Be Scheduled';
    const portalDirectLink = `https://sujhc.site/?login=${student.id}&solo=true`;
    
    return `*SciVerse 2K26 Solo Registration Confirmed!* 🚀\nOrganized by: *Science Union, Jaffna Hindu College*\n\nDear *${student.name}*,\n\nWe are thrilled to inform you that your solo registration is officially confirmed! \n\n*Admission & Portal Access:*\n============================\n🎫 *Registration ID:* ${regId}\n📅 *Event Day:* ${preferredDay}\n⏰ *Arrival Time Slot:* ${arrivalTime}\n\n*Download your QR Pass here:*\n============================\n${portalDirectLink}\n\n*Official Updates Group:*\n============================\nJoin the official SciVerse WhatsApp updates group for announcements:\nhttps://chat.whatsapp.com/LLz5gMnnPS79RgyCizDR0l\n\n*Instructions:*\n1. Click the link above to access your personal dashboard.\n2. Download your QR Entry Pass from the dashboard.\n3. Present your Registration ID or QR Pass at the gate for verification.\n\nSee you at the Science Union Exhibition!`;
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

    // Subscribe to anonymous reviews
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackReview));
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReviews(list);
    }, (error) => {
      console.error("Error subscribing to anonymous reviews:", error);
    });

    return () => {
      unsubSchools();
      unsubDays();
      unsubSlots();
      unsubLogs();
      unsubAdmins();
      unsubSolo();
      unsubReviews();
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
            quota: school.quota && school.quota < 9999 ? school.quota : ((school.expectedStudents || 0) + (school.expectedTeachers || 0) || 30),
            expectedStudents: school.expectedStudents || 0,
            expectedTeachers: school.expectedTeachers || 0,
            preferredDay: school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)',
            arrivalTime: school.arrivalTime || '08:30 AM - 09:00 AM',
            smtpConfig,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to automatically dispatch confirmation email:", emailErr);
      }

      // Automatically dispatch WhatsApp confirmation message
      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: getWahaHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            phone: school.whatsapp || school.contact || '',
            message: getWhatsAppMessage(school, regId)
          })
        });
      } catch (waErr) {
        console.error("Failed to automatically dispatch confirmation WhatsApp:", waErr);
      }

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
          quota: school.quota && school.quota < 9999 ? school.quota : ((school.expectedStudents || 0) + (school.expectedTeachers || 0) || 30),
          expectedStudents: school.expectedStudents || 0,
          expectedTeachers: school.expectedTeachers || 0,
          preferredDay: school.preferredDay || 'Day 2 - Exhibitions & Practical Labs (July 23)',
          arrivalTime: school.arrivalTime || '08:30 AM - 09:00 AM',
          smtpConfig,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const cleanText = text.replace(/<[^>]*>/g, " ").trim();
        const truncatedText = cleanText.substring(0, 180) + (cleanText.length > 180 ? "..." : "");
        throw new Error(truncatedText || `HTTP ${res.status} ${res.statusText}`);
      }

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

    const fetchSmtpConfig = async () => {
      try {
        const emailConfigRef = doc(db, 'configs', 'email');
        const configSnap = await getDoc(emailConfigRef);
        if (configSnap.exists()) {
          const data = configSnap.data();
          setSmtpConfig({
            host: data.host || '',
            port: data.port || '587',
            secure: data.secure || false,
            user: data.user || '',
            pass: data.pass || '',
            resendApiKey: data.resendApiKey || '',
            senderEmail: data.senderEmail || 'noreply@npfp.site',
            senderName: data.senderName || 'SciVerse 2K26'
          });
        }
      } catch (err) {
        console.error("Error fetching SMTP config on mount: ", err);
      }
    };

    fetchConfig();
    fetchSmtpConfig();
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

  // Handle SMTP Settings Save
  const handleSaveSmtpSettings = async () => {
    if (!isAdmin) {
      toastError("You do not have permission to change these settings.");
      return;
    }
    setIsSavingSmtp(true);
    try {
      const emailConfigRef = doc(db, 'configs', 'email');
      await setDoc(emailConfigRef, { 
        ...smtpConfig,
        updatedBy: user?.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      success('SMTP Connection Settings updated and saved in Firestore!');
    } catch (err: any) {
      console.error("Error saving SMTP settings: ", err);
      toastError(err.message || "Failed to save SMTP settings.");
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // Handle Send Test Email
  const handleSendTestEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) {
      toastError("Please enter a valid recipient email.");
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailError(null);
    setTestEmailSuccess(null);
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmailRecipient.trim(),
          subject: 'SciVerse 2K26 - SMTP Configuration Test Successful!',
          body: `SMTP connection validation check performed on ${new Date().toLocaleString()}.`,
          smtpConfig: smtpConfig
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(text || `HTTP ${response.status} ${response.statusText}`);
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "SMTP server failed to dispatch test email.");
      }

      setTestEmailSuccess(`Test email dispatched successfully! Provider strategy: ${data.method.toUpperCase()}. Check your inbox.`);
      success("Test email sent successfully! Check inbox.");
    } catch (err: any) {
      console.error("SMTP Test Dispatch Error:", err);
      setTestEmailError(err.message || String(err));
      toastError("SMTP test failed. Please verify credentials.");
    } finally {
      setIsSendingTestEmail(false);
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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const cleanText = text.replace(/<[^>]*>/g, " ").trim();
        const truncatedText = cleanText.substring(0, 180) + (cleanText.length > 180 ? "..." : "");
        throw new Error(truncatedText || `HTTP ${response.status} ${response.statusText}`);
      }

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

      const currentDetails = targetDay.reservedDetails || {};
      const details = {
        vips: currentDetails.vips || 0,
        judges: currentDetails.judges || 0,
        organizers: currentDetails.organizers || 0,
        teachers: currentDetails.teachers || 0,
        media: currentDetails.media || 0,
        guests: currentDetails.guests || 0,
        students: currentDetails.students || 0
      };

      const updatedDetails = {
        ...details,
        [category]: Number(value)
      };

      const sumReserved = Object.values(updatedDetails).reduce((acc: number, curr: any) => acc + Number(curr), 0);

      await updateDoc(dayRef, {
        reservedDetails: updatedDetails,
        reservedSeats: sumReserved
      });
    } catch (err: any) {
      console.error(err);
      toastError(`Failed to update seats: ${err.message || 'Unknown error'}`);
    }
  };

  // Quick reserve 500 students for July 23rd (day-2) and July 24th (day-3)
  const handleBatchReserve500Students = async () => {
    try {
      const daysToUpdate = ['day-2', 'day-3'];
      let updatedAny = false;

      for (const dayId of daysToUpdate) {
        const dayRef = doc(db, 'eventDays', dayId);
        const targetDay = eventDays.find(d => d.id === dayId);
        if (!targetDay) continue;

        const currentDetails = targetDay.reservedDetails || {};
        const updatedDetails = {
          vips: currentDetails.vips || 0,
          judges: currentDetails.judges || 0,
          organizers: currentDetails.organizers || 0,
          teachers: currentDetails.teachers || 0,
          media: currentDetails.media || 0,
          guests: currentDetails.guests || 0,
          students: 500
        };

        const sumReserved = Object.values(updatedDetails).reduce((acc: number, curr: any) => acc + Number(curr), 0);

        await updateDoc(dayRef, {
          reservedDetails: updatedDetails,
          reservedSeats: sumReserved
        });
        updatedAny = true;
      }

      if (updatedAny) {
        success('Successfully reserved 500 seats for students on July 23rd and 24th!');
      } else {
        toastWarning('No matching event days found to apply the student reservation.');
      }
    } catch (err: any) {
      console.error(err);
      toastError(`Failed to apply student reservations: ${err.message || 'Unknown error'}`);
    }
  };

  // Quick action to reduce student reservation seats (by 120 on July 23rd and 150 on July 24th)
  const handleBatchReduceStudents = async () => {
    try {
      const reductions: { [key: string]: number } = { 'day-2': 120, 'day-3': 150 };
      let updatedAny = false;

      for (const [dayId, reduceAmount] of Object.entries(reductions)) {
        const dayRef = doc(db, 'eventDays', dayId);
        const targetDay = eventDays.find(d => d.id === dayId);
        if (!targetDay) continue;

        const currentDetails = targetDay.reservedDetails || {};
        const currentStudents = currentDetails.students !== undefined ? Number(currentDetails.students) : 500;
        const newStudents = Math.max(0, currentStudents - reduceAmount);

        const updatedDetails = {
          vips: currentDetails.vips || 0,
          judges: currentDetails.judges || 0,
          organizers: currentDetails.organizers || 0,
          teachers: currentDetails.teachers || 0,
          media: currentDetails.media || 0,
          guests: currentDetails.guests || 0,
          students: newStudents
        };

        const sumReserved = Object.values(updatedDetails).reduce((acc: number, curr: any) => acc + Number(curr), 0);

        await updateDoc(dayRef, {
          reservedDetails: updatedDetails,
          reservedSeats: sumReserved
        });
        updatedAny = true;
      }

      if (updatedAny) {
        success('Successfully reduced student reservations by 120 on July 23rd and 150 on July 24th!');
      } else {
        toastWarning('No matching event days found to apply the reductions.');
      }
    } catch (err: any) {
      console.error(err);
      toastError(`Failed to apply student reductions: ${err.message || 'Unknown error'}`);
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

      // Automatically dispatch confirmation email using SMTP config
      const qrPassUrl = `https://quickchart.io/chart?cht=qr&chl=${regId}&chs=150x150`;
      try {
        await fetch('/api/email/confirm', {
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
            isSolo: true,
            smtpConfig,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to automatically dispatch solo confirmation email:", emailErr);
      }

      // Automatically dispatch WhatsApp confirmation message
      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: getWahaHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            phone: student.whatsapp || student.contact || '',
            message: getWhatsAppMessageSolo(student, regId)
          })
        });
      } catch (waErr) {
        console.error("Failed to automatically dispatch confirmation WhatsApp:", waErr);
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
      phone: student.whatsapp || student.contact || '',
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
          isSolo: true,
          smtpConfig,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const cleanText = text.replace(/<[^>]*>/g, " ").trim();
        const truncatedText = cleanText.substring(0, 180) + (cleanText.length > 180 ? "..." : "");
        throw new Error(truncatedText || `HTTP ${res.status} ${res.statusText}`);
      }

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

  const handleExportReviewsCSV = () => {
    if (reviews.length === 0) {
      toastWarning("No reviews found to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Review ID,User Type,Rating (Out of 10),Overall Experience,Suggested Changes,Future Expectations,Impact,Submission Timestamp\r\n";

    reviews.forEach(r => {
      const cleanExp = (r.experience || "").replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanChange = (r.canBeChanged || "").replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanFuture = (r.futureExpectations || "").replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanImpact = (r.impact || "").replace(/"/g, '""').replace(/\n/g, ' ');
      const row = `"${r.id || ''}","${r.userType.toUpperCase()}",${r.rating},"${cleanExp}","${cleanChange}","${cleanFuture}","${cleanImpact}","${r.createdAt}"`;
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SciVerse_2K26_Exhibition_Reviews.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Anonymous reviews exported successfully as CSV!");
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this anonymous feedback review? This action is irreversible.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      success("Anonymous review deleted successfully.");
    } catch (err) {
      console.error("Error deleting review:", err);
      toastError("Failed to delete review.");
    }
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
                {activeTab === 'reviews' && 'Anonymous Ratings & Reviews'}
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
                    { id: 'reviews', label: `Anonymous Reviews (${reviews.length})` },
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

            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'reviews' ? 'text-amber-400 border-amber-500' : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Anonymous Reviews ({reviews.length})
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-500/5 border border-blue-500/25 p-5 rounded-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      Quick Seat Allocation Actions
                    </h3>
                    <p className="text-xs text-slate-400">Allocate bulk capacity constraints or apply custom reductions instantly</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={handleBatchReserve500Students}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/20 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 hover:scale-[1.02] w-full sm:w-auto"
                    >
                      <Users className="w-4 h-4" />
                      Reserve 500 Students
                    </button>
                    <button
                      onClick={handleBatchReduceStudents}
                      className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 hover:scale-[1.02] w-full sm:w-auto"
                    >
                      <UserMinus className="w-4 h-4" />
                      Reduce Students (-120 & -150)
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">Event Seating Allocations</h3>
                  <p className="text-xs text-slate-400">Configure safety thresholds and reserve seating bounds for days</p>
                </div>

                <div className="space-y-6">
                  {eventDays.map((day) => {
                    const rDetails = {
                      vips: 0,
                      judges: 0,
                      organizers: 0,
                      teachers: 0,
                      media: 0,
                      guests: 0,
                      students: 0,
                      ...(day.reservedDetails || {})
                    };
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
                        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
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
                          <div>
                            <label className="block text-[9px] text-blue-400 font-mono uppercase mb-1">Students</label>
                            <input 
                              type="number"
                              value={rDetails.students}
                              onChange={e => handleSeatChange(day.id, 'students', Number(e.target.value))}
                              className="w-full bg-slate-900 border border-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono"
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
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">System Notification Logs</h3>
                  <p className="text-xs text-slate-400">Review email and WhatsApp notification triggers sent during approvals, updates, and invitations</p>
                </div>

                {/* WAHA Connection Checker Trigger */}
                <button
                  disabled={wahaCheckLoading}
                  onClick={handleCheckWahaStatus}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-slate-950 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-500/10"
                >
                  {wahaCheckLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      Checking Connection...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4 shrink-0" />
                      Check WAHA Connection
                    </>
                  )}
                </button>
              </div>

              {/* WAHA CONFIG OVERRIDES PANEL */}
              <div className="border border-white/5 rounded-2xl bg-slate-950/40 p-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setShowWahaSettings(!showWahaSettings)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-400 animate-pulse" /> WAHA Connection Settings Overrides
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      If your WAHA server uses a hashed API Key, enter the <strong>raw, unhashed API Key</strong> here.
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showWahaSettings ? 'rotate-180' : ''}`} />
                </button>

                {showWahaSettings && (
                  <div className="pt-4 grid md:grid-cols-3 gap-4 border-t border-white/5 animate-slideDown">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">WAHA Server URL</label>
                      <input
                        type="text"
                        placeholder="https://devlikeaprowaha-production-5bc7.up.railway.app"
                        value={wahaUrlOverride}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setWahaUrlOverride(val);
                          localStorage.setItem("waha_url_override", val);
                        }}
                        className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        Raw API Key (Unhashed)
                        {wahaKeyOverride.startsWith("sha512:") && (
                          <span className="text-[9px] text-red-400 lowercase font-sans">⚠️ should be raw, not sha512: hash</span>
                        )}
                      </label>
                      <input
                        type="password"
                        placeholder="your_raw_api_key (leave blank if none, or 'none')"
                        value={wahaKeyOverride}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setWahaKeyOverride(val);
                          localStorage.setItem("waha_key_override", val);
                        }}
                        className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Target Session Name</label>
                      <input
                        type="text"
                        placeholder="default"
                        value={wahaSessionOverride}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setWahaSessionOverride(val);
                          localStorage.setItem("waha_session_override", val);
                        }}
                        className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SMTP / EMAIL CONFIGURATION PANEL */}
              <div className="border border-white/5 rounded-2xl bg-slate-950/40 p-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setShowSmtpSettings(!showSmtpSettings)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-sky-400" /> Automated Email / SMTP Settings
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Configure your NodeMailer SMTP Server or Resend API key for automatic email delivery.
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showSmtpSettings ? 'rotate-180' : ''}`} />
                </button>

                {showSmtpSettings && (
                  <div className="pt-4 border-t border-white/5 space-y-6 animate-slideDown">
                    {/* Mode Toggle Info */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-xs text-slate-300 space-y-3">
                      <p className="font-semibold text-white flex items-center gap-1.5 font-mono uppercase text-[10px] tracking-wider text-sky-400">
                        <Sparkles className="w-3.5 h-3.5" /> Configuration Instructions & Deliverability Guide
                      </p>
                      <p>You can choose to configure either standard <strong>SMTP</strong> (Gmail, Mailgun, custom SMTP) OR a <strong>Resend API Key</strong>. If both are left blank, emails fall back to the server environment variables or console-simulation mode.</p>
                      <div className="border-t border-white/5 pt-2.5 space-y-1.5">
                        <p className="font-semibold text-[10px] uppercase font-mono tracking-wider text-amber-400">🛡️ How to prevent emails from going to the SPAM folder:</p>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 leading-relaxed">
                          <li><strong>Match Sender Email:</strong> Ensure your <em>Sender Email Address</em> (below) is identical to or authorized by your SMTP Username. For example, if authenticating with <code>school@gmail.com</code>, do NOT send as <code>noreply@npfp.site</code>. This triggers strict DMARC/SPF anti-spoofing filters.</li>
                          <li><strong>App Passwords:</strong> If using Gmail, you must generate and use a 16-character <em>App Password</em> from your Google Account settings, rather than your actual account password.</li>
                          <li><strong>Option B (Resend API):</strong> This is highly recommended for professional deliverability. Make sure you add and verify your custom sending domain in your Resend Dashboard, which automatically signs emails with SPF and DKIM.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Sender Identity Details */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Sender Name</label>
                        <input
                          type="text"
                          placeholder="SciVerse 2K26"
                          value={smtpConfig.senderName}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, senderName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Sender Email Address</label>
                        <input
                          type="email"
                          placeholder="noreply@npfp.site"
                          value={smtpConfig.senderEmail}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, senderEmail: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 pt-2">
                      {/* Left: SMTP Configuration */}
                      <div className="space-y-4 border-r md:border-white/5 pr-0 md:pr-6">
                        <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">Option A: SMTP Host Server</h5>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Host URL</label>
                            <input
                              type="text"
                              placeholder="smtp.gmail.com"
                              value={smtpConfig.host}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Port</label>
                            <input
                              type="text"
                              placeholder="587"
                              value={smtpConfig.port}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Username / User</label>
                            <input
                              type="text"
                              placeholder="your-email@gmail.com"
                              value={smtpConfig.user}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Password / App Key</label>
                            <input
                              type="password"
                              placeholder="••••••••••••••••"
                              value={smtpConfig.pass}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="smtp-secure"
                            checked={smtpConfig.secure}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                            className="rounded border-white/10 bg-slate-950 text-sky-500 focus:ring-sky-500 cursor-pointer"
                          />
                          <label htmlFor="smtp-secure" className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider cursor-pointer">
                            Use SSL (Secure port 465)
                          </label>
                        </div>
                      </div>

                      {/* Right: Resend Configuration */}
                      <div className="space-y-4">
                        <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">Option B: Resend API Key</h5>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Resend API Key</label>
                          <input
                            type="password"
                            placeholder="re_••••••••••••••••••••••••"
                            value={smtpConfig.resendApiKey}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, resendApiKey: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                          />
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Using Resend is highly recommended. It handles deliverability, domain alignment, and bypasses local firewall blocks automatically.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
                      <button
                        type="button"
                        disabled={isSavingSmtp}
                        onClick={handleSaveSmtpSettings}
                        className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-slate-950 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-500/10"
                      >
                        {isSavingSmtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving Settings...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save Email Settings
                          </>
                        )}
                      </button>
                    </div>

                    {/* Test SMTP connection outbox */}
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <h5 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">Test Configuration Connection</h5>
                      
                      <form onSubmit={handleSendTestEmail} className="flex gap-3 items-end max-w-lg">
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider">Recipient Email Address</label>
                          <input
                            type="email"
                            placeholder="recipient@example.com"
                            value={testEmailRecipient}
                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSendingTestEmail}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 border border-white/10 text-white text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
                        >
                          {isSendingTestEmail ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Send Test Email
                            </>
                          )}
                        </button>
                      </form>

                      {testEmailSuccess && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-mono animate-fadeIn">
                          ✅ {testEmailSuccess}
                        </div>
                      )}

                      {testEmailError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-mono animate-fadeIn leading-relaxed">
                          ❌ <strong>SMTP Test Failed:</strong> {testEmailError}
                          <div className="mt-1 text-[10px] text-slate-400">
                            Tips: Double-check port number (587 TLS vs 465 SSL), ensure your provider allows login (e.g. Google App Passwords), or check if firewalls block SMTP connections.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* WAHA STATUS WIDGET DISPLAY */}
              {wahaStatusData && (
                <div className="border border-white/10 rounded-2xl bg-slate-900 p-5 space-y-4 animate-fadeIn">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400" /> WAHA Engine Diagnostics
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Status check query dispatched to <code className="text-slate-300 font-mono bg-slate-950 px-1 py-0.5 rounded text-[10px]">{wahaStatusData.wahaApiUrl}</code></p>
                    </div>

                    <div>
                      {wahaStatusData.connected ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🟢 Online & Working
                        </span>
                      ) : wahaStatusData.status === "SCAN_QR" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          🟡 Scan QR Code
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          🔴 Offline ({wahaStatusData.status || "UNREACHABLE"})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-950/40 border border-white/5 p-3 rounded-xl space-y-1.5">
                      <p className="text-slate-400">Target Session: <strong className="text-white">{wahaStatusData.session?.name || "default"}</strong></p>
                      <p className="text-slate-400">Connection State: <strong className={wahaStatusData.connected ? "text-emerald-400" : "text-amber-400"}>{wahaStatusData.status || "UNKNOWN"}</strong></p>
                    </div>

                    <div className="bg-slate-950/40 border border-white/5 p-3 rounded-xl space-y-1.5">
                      {wahaStatusData.connected ? (
                        <p className="text-emerald-400 leading-normal font-sans">
                          🎉 Perfect! The WhatsApp Web engine is connected and ready to send instant automated notifications to your delegation and solo registrants.
                        </p>
                      ) : wahaStatusData.status === "SCAN_QR" ? (
                        <p className="text-amber-300 leading-normal font-sans">
                          ⚠️ Action Required: Your WhatsApp session is initialized but requires phone pairing. Scan the QR code or link your device inside your WAHA web interface.
                        </p>
                      ) : (
                        <p className="text-red-400 leading-normal font-sans">
                          ❌ Connection Failure: {wahaStatusData.error || "The server could not establish a connection to your custom WAHA engine. Make sure the container is healthy and process.env variables are correctly injected."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

          {/* TAB 8: ANONYMOUS FEEDBACK & RATINGS */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Anonymous Exhibition Critiques & Ratings
                  </h3>
                  <p className="text-xs text-slate-400">View and evaluate anonymous surveys from viewers and teacher-mentors</p>
                </div>
                
                <button
                  onClick={handleExportReviewsCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-mono font-bold text-slate-950 transition cursor-pointer shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                >
                  <Download className="w-4 h-4" />
                  Download Reviews CSV
                </button>
              </div>

              {/* Reviews Overview Metrics cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Total Reviews</span>
                  <p className="text-2xl font-bold font-mono text-white mt-1">{reviews.length}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Recorded anonymously</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Average Star Rating</span>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {reviews.length > 0 
                      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                      : "0.0"
                    }
                    <span className="text-xs font-normal text-slate-500 font-sans"> / 10.0</span>
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Organizers rating score</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Viewers / Students</span>
                  <p className="text-2xl font-bold font-mono text-blue-400 mt-1">
                    {reviews.filter(r => r.userType === 'viewer').length}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">General observers</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Teachers / Mentors</span>
                  <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">
                    {reviews.filter(r => r.userType === 'teacher').length}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Academic evaluators</p>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  
                  {/* Filter Type */}
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">Role Profile</span>
                    <select
                      value={reviewTypeFilter}
                      onChange={(e) => setReviewTypeFilter(e.target.value as any)}
                      className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="all">All Roles</option>
                      <option value="viewer">Viewer / Student</option>
                      <option value="teacher">Teacher / Mentor</option>
                    </select>
                  </div>

                  {/* Filter Rating */}
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">Points Range</span>
                    <select
                      value={reviewRatingFilter}
                      onChange={(e) => setReviewRatingFilter(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="all">All Ratings (1-10)</option>
                      <option value="high">High Tier (8 - 10 ⭐)</option>
                      <option value="medium">Average Tier (4 - 7 ⭐)</option>
                      <option value="low">Critical Tier (1 - 3 ⭐)</option>
                    </select>
                  </div>

                </div>

                {/* Free Text Search */}
                <div className="flex flex-col gap-1 w-full md:w-80">
                  <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">Text Query Search</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search feedback text contents..."
                      value={reviewSearchText}
                      onChange={(e) => setReviewSearchText(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-4 py-1.5 text-xs text-white font-mono placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Reviews list */}
              <div className="space-y-4">
                {reviews.filter(r => {
                  if (reviewTypeFilter !== 'all' && r.userType !== reviewTypeFilter) return false;
                  if (reviewRatingFilter === 'high' && r.rating < 8) return false;
                  if (reviewRatingFilter === 'medium' && (r.rating < 4 || r.rating > 7)) return false;
                  if (reviewRatingFilter === 'low' && r.rating > 3) return false;
                  if (reviewSearchText.trim()) {
                    const q = reviewSearchText.toLowerCase();
                    const text = `${r.experience} ${r.canBeChanged} ${r.futureExpectations} ${r.impact}`.toLowerCase();
                    if (!text.includes(q)) return false;
                  }
                  return true;
                }).length === 0 ? (
                  <div className="text-center py-16 bg-white/[0.01] border border-white/5 rounded-2xl">
                    <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No anonymous reviews matching these search filters.</p>
                    <p className="text-xs text-slate-500 mt-1">Adjust your points range filters or search text query query.</p>
                  </div>
                ) : (
                  reviews
                    .filter(r => {
                      if (reviewTypeFilter !== 'all' && r.userType !== reviewTypeFilter) return false;
                      if (reviewRatingFilter === 'high' && r.rating < 8) return false;
                      if (reviewRatingFilter === 'medium' && (r.rating < 4 || r.rating > 7)) return false;
                      if (reviewRatingFilter === 'low' && r.rating > 3) return false;
                      if (reviewSearchText.trim()) {
                        const q = reviewSearchText.toLowerCase();
                        const text = `${r.experience} ${r.canBeChanged} ${r.futureExpectations} ${r.impact}`.toLowerCase();
                        if (!text.includes(q)) return false;
                      }
                      return true;
                    })
                    .map((rev) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={rev.id}
                        className="bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4 transition-colors relative group"
                      >
                        {/* Header Details */}
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border ${
                              rev.userType === 'teacher'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {rev.userType === 'teacher' ? 'Teacher / Educator' : 'General Viewer / Student'}
                            </span>
                            
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Ratings Display */}
                          <div className="flex items-center gap-3">
                            <div className="flex gap-0.5 bg-slate-950/50 border border-white/5 px-3 py-1 rounded-full">
                              {[...Array(10)].map((_, idx) => (
                                <Star 
                                  key={idx} 
                                  className={`w-3 h-3 ${idx < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} 
                                />
                              ))}
                              <span className="text-[11px] font-mono font-bold text-white pl-1.5">{rev.rating}/10</span>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteReview(rev.id!)}
                              className="p-1.5 bg-white/5 hover:bg-red-500/15 hover:text-red-400 border border-white/5 rounded-lg text-slate-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Delete anonymous review"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Detailed Responses Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          
                          {/* Q1 */}
                          <div className="bg-slate-950/30 border border-white/5 p-4 rounded-xl space-y-1">
                            <h4 className="text-[10px] font-bold font-mono text-blue-400 uppercase tracking-wider">
                              • What was the experience?
                            </h4>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                              {rev.experience}
                            </p>
                          </div>

                          {/* Q2 */}
                          <div className="bg-slate-950/30 border border-white/5 p-4 rounded-xl space-y-1">
                            <h4 className="text-[10px] font-bold font-mono text-indigo-400 uppercase tracking-wider">
                              • What can be changed?
                            </h4>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                              {rev.canBeChanged}
                            </p>
                          </div>

                          {/* Q3 */}
                          <div className="bg-slate-950/30 border border-white/5 p-4 rounded-xl space-y-1">
                            <h4 className="text-[10px] font-bold font-mono text-pink-400 uppercase tracking-wider">
                              • What do you expect in the future?
                            </h4>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                              {rev.futureExpectations}
                            </p>
                          </div>

                          {/* Q4 */}
                          <div className="bg-slate-950/30 border border-white/5 p-4 rounded-xl space-y-1">
                            <h4 className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider">
                              • What's the impact?
                            </h4>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                              {rev.impact}
                            </p>
                          </div>

                        </div>
                      </motion.div>
                    ))
                )}
              </div>

            </div>
          )}

        </div>

      </main>

      {/* WhatsApp Manual & API Notification Dispatcher Modal */}
      <AnimatePresence>
        {waModalData && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">WhatsApp Notification Portal</h3>
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

              {/* Status Banner */}
              {waApiSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-400 leading-relaxed flex items-start gap-2 animate-fadeIn">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Success:</strong> {waApiSuccess}
                  </div>
                </div>
              )}

              {waApiError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-300 leading-relaxed space-y-2 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <strong>API Alert:</strong> {waApiError}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-amber-500/10 space-y-1">
                    <p className="text-[10px] text-slate-400"><strong>To enable fully automated WhatsApp alerts:</strong></p>
                    <p className="text-[10px] text-slate-400 leading-normal">Configure <strong>WAHA API</strong>, <strong>Meta Cloud API</strong>, or <strong>Twilio WhatsApp</strong> credentials in your app secrets settings panel.</p>
                  </div>
                </div>
              )}

              {!waApiSuccess && !waApiError && (
                <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
                  📢 Choose between <strong>Automated API Dispatch</strong> (requires credentials) or <strong>Manual Redirection</strong> via WhatsApp Web.
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Verify WhatsApp Number</label>
                  <input
                    type="text"
                    value={waModalData.phone}
                    onChange={e => setWaModalData({ ...waModalData, phone: e.target.value })}
                    placeholder="Enter phone with country code, e.g. +94771234567"
                    className="w-full bg-slate-950 border border-white/10 focus:border-green-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Include country code without symbols (e.g. 94 for Sri Lanka).</p>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Preview Message Content</label>
                  <textarea
                    rows={8}
                    value={waModalData.message}
                    onChange={e => setWaModalData({ ...waModalData, message: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 focus:border-green-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-300 font-sans leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    disabled={isSendingWa}
                    onClick={handleSendWaApi}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-500/10"
                  >
                    {isSendingWa ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Cpu className="w-4 h-4 shrink-0" />
                        API Dispatch
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const cleanPhone = waModalData.phone.replace(/[^0-9]/g, '');
                      const encodedMsg = encodeURIComponent(waModalData.message);
                      window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                      setWaModalData(null);
                    }}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                    Manual Web
                  </button>
                </div>

                <button
                  onClick={() => setWaModalData(null)}
                  className="w-full py-2.5 bg-transparent border border-white/5 hover:border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-mono uppercase tracking-wider transition cursor-pointer"
                >
                  Dismiss / Skip
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
